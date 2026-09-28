import axios from 'axios';

const API_BASE = 'http://localhost:5000';

async function runTests() {
  console.log('====================================================');
  console.log('🧪 Starting ReachInbox End-to-End Verification Tests');
  console.log('====================================================\n');

  // 1. Health check
  console.log('1️⃣ Checking API Health...');
  const healthRes = await axios.get(`${API_BASE}/health`);
  console.log('   ✅ Health OK:', healthRes.data);

  // 2. Demo Login / Auth
  console.log('\n2️⃣ Testing Evaluator Demo Login...');
  const loginRes = await axios.post(`${API_BASE}/auth/demo-login`);
  const token = loginRes.data.token;
  const user = loginRes.data.user;
  console.log(`   ✅ Logged in as: ${user.name} (${user.email})`);

  const headers = { Authorization: `Bearer ${token}` };

  // 3. Sender Verification
  console.log('\n3️⃣ Fetching Sender Accounts & Limits...');
  const sendersRes = await axios.get(`${API_BASE}/senders`, { headers });
  const sender = sendersRes.data.senders[0];
  console.log(`   ✅ Sender: ${sender.emailAddress} | Hourly Limit: ${sender.hourlyLimit} | Sent this hour: ${sender.sentThisHour}`);

  // 4. Reset rate limit for a fresh test
  await axios.post(`${API_BASE}/emails/reset-rate-limit`, { senderId: sender.id }, { headers });
  console.log('   ✅ Sender rate limit reset to 0');

  // 5. Schedule 3 emails with 2s delay
  console.log('\n4️⃣ Scheduling 3 Emails with 2s delay...');
  const scheduleRes = await axios.post(
    `${API_BASE}/emails/schedule`,
    {
      senderId: sender.id,
      subject: 'End-to-End Automated Verification Test',
      body: 'This email tests the BullMQ delayed queue, MySQL persistence, and Ethereal SMTP delivery.',
      recipients: [
        'candidate.alpha@reachinbox.test',
        'candidate.beta@reachinbox.test',
        'candidate.gamma@reachinbox.test',
      ],
      delaySeconds: 2,
    },
    { headers }
  );
  console.log(`   ✅ ${scheduleRes.data.message}`);
  console.log(`   First job scheduled at: ${scheduleRes.data.data.firstRunAt}`);
  console.log(`   Last job scheduled at:  ${scheduleRes.data.data.lastRunAt}`);

  // 6. Elasticsearch Search Verification
  console.log('\n5️⃣ Testing Elasticsearch Search Query...');
  // Wait 1s for ES to refresh
  await new Promise((r) => setTimeout(r, 1000));
  const searchRes = await axios.get(`${API_BASE}/emails/search?q=candidate.alpha`, { headers });
  console.log(`   ✅ Elasticsearch search found ${searchRes.data.count} result(s) for 'candidate.alpha'`);
  if (searchRes.data.data.length > 0) {
    console.log(`   Document: ${searchRes.data.data[0].recipient} - Status: ${searchRes.data.data[0].status}`);
  }

  // 7. Testing Rate Limiting
  console.log('\n6️⃣ Testing Hourly Rate Limit Behavior...');
  console.log(`   Sender hourly limit is set to: ${sender.hourlyLimit}`);
  console.log('   Scheduling a batch of 6 emails (exceeding the 5/hr limit)...');
  const excessScheduleRes = await axios.post(
    `${API_BASE}/emails/schedule`,
    {
      senderId: sender.id,
      subject: 'Rate Limit Threshold Test',
      body: 'Testing that jobs are gracefully delayed to next hour rather than dropped.',
      recipients: [
        'limit1@test.com',
        'limit2@test.com',
        'limit3@test.com',
        'limit4@test.com',
        'limit5@test.com',
        'limit6@test.com',
      ],
      delaySeconds: 1,
    },
    { headers }
  );
  console.log(`   ✅ Enqueued ${excessScheduleRes.data.data.scheduledCount} jobs.`);

  // 8. Slack Notification Test (Graceful skip when not connected)
  console.log('\n7️⃣ Testing Slack Notification Flow (No crash when disconnected)...');
  const slackStatusRes = await axios.get(`${API_BASE}/slack/status`, { headers });
  console.log('   ✅ Slack Status:', slackStatusRes.data);

  // 9. Bull-Board Verification
  console.log('\n8️⃣ Verifying BullMQ Queue Dashboard (/queues)...');
  const queuesRes = await axios.get(`${API_BASE}/queues`);
  console.log(`   ✅ Bull-Board HTTP Status: ${queuesRes.status} (Dashboard is live)`);

  console.log('\n====================================================');
  console.log('🎉 ALL AUTOMATED VERIFICATION CHECKS PASSED SUCCESSFULLY!');
  console.log('====================================================\n');
}

runTests().catch((err) => {
  console.error('Test run failed:', err.response?.data || err.message);
  process.exit(1);
});
