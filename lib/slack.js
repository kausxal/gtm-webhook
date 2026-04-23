const axios = require("axios");

async function notify(type, data) {
  const messages = {
    duplicate: {
      text: `*Returning visitor - no action*\n*Name:* ${data.name}\n*Company:* ${data.company}\n*Email:* ${data.email}\n*Pages:* ${data.pagesVisited}\n_Seen in last 7 days, skipped_`
    },
    existing_client: {
      text: `*Existing contact visited site*\n*Name:* ${data.name}\n*Company:* ${data.company}\n*Stage:* ${data.lifecyclestage}\n*Pages:* ${data.pagesVisited}\n_No outreach fired — notify AE_`
    },
    low_icp: {
      text: `*Low ICP visitor*\n*Name:* ${data.name}\n*Company:* ${data.company}\n*ICP Score:* ${data.icpScore}/100\n*Reasons failed:* ${data.reasons}\n_Logged only, no outreach_`
    },
    hot_lead: {
      text: `*HOT LEAD ACTIONED*\n*Name:* ${data.name}\n*Title:* ${data.title} at ${data.company}\n*ICP Score:* ${data.icpScore}/100 (${data.leadTier})\n*Pages visited:* ${data.pagesVisited}\n*LinkedIn:* ${data.linkedinUrl}\n*HeyReach:* connection sent + enrolled in campaign\n*Instantly:* email campaign enrolled\n*HubSpot:* MQL created`
    }
  };

  const message = messages[type];
  if (!message) return;

  try {
    await axios.post(process.env.SLACK_WEBHOOK_URL, message);
  } catch (e) {
    console.error("Slack notify failed:", e.message);
  }
}

module.exports = { notify };
