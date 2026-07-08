const session = JSON.parse(localStorage.getItem('agencyflow_session') || 'null');

if (!session) {
  window.location.href = 'index.html';
}

document.getElementById('user-name').textContent = session.name || 'User';
document.getElementById('user-email').textContent = session.email;

document.getElementById('logout-btn').addEventListener('click', () => {
  localStorage.removeItem('agencyflow_session');
  window.location.href = 'index.html';
});

function animateCounter(element) {
  const target = parseFloat(element.dataset.target);
  const prefix = element.dataset.prefix || '';
  const suffix = element.dataset.suffix || '';
  const isDecimal = target % 1 !== 0;
  const duration = 1200;
  const start = performance.now();

  function frame(now) {
    const progress = Math.min((now - start) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    const value = target * eased;
    element.textContent = prefix + (isDecimal ? value.toFixed(1) : Math.round(value).toLocaleString()) + suffix;
    if (progress < 1) requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
}

document.querySelectorAll('.stat-value').forEach(animateCounter);

function drawChart() {
  const canvas = document.getElementById('traffic-chart');
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;

  canvas.width = width * dpr;
  canvas.height = height * dpr;
  ctx.scale(dpr, dpr);

  const data = [42, 58, 45, 72, 68, 85, 79];
  const labels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const padding = { top: 20, right: 20, bottom: 30, left: 40 };
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;
  const max = Math.max(...data) * 1.1;

  ctx.clearRect(0, 0, width, height);

  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const y = padding.top + (chartH / 4) * i;
    ctx.beginPath();
    ctx.moveTo(padding.left, y);
    ctx.lineTo(width - padding.right, y);
    ctx.stroke();
  }

  const gradient = ctx.createLinearGradient(0, padding.top, 0, height - padding.bottom);
  gradient.addColorStop(0, 'rgba(102, 126, 234, 0.35)');
  gradient.addColorStop(1, 'rgba(102, 126, 234, 0)');

  const points = data.map((value, i) => ({
    x: padding.left + (chartW / (data.length - 1)) * i,
    y: padding.top + chartH - (value / max) * chartH,
  }));

  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  points.slice(1).forEach((p) => ctx.lineTo(p.x, p.y));
  ctx.lineTo(points[points.length - 1].x, height - padding.bottom);
  ctx.lineTo(points[0].x, height - padding.bottom);
  ctx.closePath();
  ctx.fillStyle = gradient;
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  points.slice(1).forEach((p) => ctx.lineTo(p.x, p.y));
  ctx.strokeStyle = '#667eea';
  ctx.lineWidth = 2.5;
  ctx.stroke();

  points.forEach((p) => {
    ctx.beginPath();
    ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
    ctx.fillStyle = '#667eea';
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.stroke();
  });

  ctx.fillStyle = '#718096';
  ctx.font = '12px Inter, sans-serif';
  ctx.textAlign = 'center';
  labels.forEach((label, i) => {
    const x = padding.left + (chartW / (data.length - 1)) * i;
    ctx.fillText(label, x, height - 8);
  });
}

drawChart();
window.addEventListener('resize', drawChart);

const activities = [
  { user: 'Sarah K.', action: 'published a new report', time: '2 min ago' },
  { user: 'Mike R.', action: 'updated project settings', time: '14 min ago' },
  { user: 'Alex T.', action: 'invited 3 team members', time: '28 min ago' },
  { user: 'Jordan L.', action: 'exported analytics data', time: '1 hr ago' },
  { user: 'Casey M.', action: 'created a new dashboard', time: '2 hr ago' },
];

const activityList = document.getElementById('activity-list');

function renderActivity(item) {
  const li = document.createElement('li');
  li.className = 'activity-item';
  li.innerHTML = `
    <div class="activity-icon">${item.user.charAt(0)}</div>
    <div>
      <div class="activity-text"><strong>${item.user}</strong> ${item.action}</div>
      <div class="activity-time">${item.time}</div>
    </div>
  `;
  activityList.prepend(li);
  if (activityList.children.length > 6) {
    activityList.removeChild(activityList.lastChild);
  }
}

activities.forEach(renderActivity);

const liveActions = [
  { user: 'Emma W.', action: 'viewed traffic report' },
  { user: 'David P.', action: 'commented on analytics' },
  { user: 'Riley S.', action: 'shared a dashboard link' },
];

setInterval(() => {
  const item = liveActions[Math.floor(Math.random() * liveActions.length)];
  renderActivity({ ...item, time: 'Just now' });
}, 8000);
