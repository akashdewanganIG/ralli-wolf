const MSG91_API_KEY = "YOUR_MSG91_API_KEY";
const MSG91_BASE_URL = "https://control.msg91.com/api/v5";

async function pollInboundMessages() {
  try {
    const response = await fetch(`${MSG91_BASE_URL}/whatsapp/inbound`, {
      headers: {
        authkey: MSG91_API_KEY,
        "Content-Type": "application/json",
      },
    });

    const messages = await response.json();

    for (const message of messages) {
      if (isStopMessage(message.text)) {
        await fetch(
          "http://localhost:4000/api/webhook/msg91/whatsapp/inbound",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(message),
          }
        );
      }
    }
  } catch (error) {
    console.error("Error polling inbound messages:", error);
  }
}

function isStopMessage(text) {
  const stopKeywords = [
    "stop",
    "unsubscribe",
    "optout",
    "opt-out",
    "opt out",
    "cancel",
  ];
  return stopKeywords.some(
    keyword =>
      text.toLowerCase().trim() === keyword ||
      text.toLowerCase().includes(keyword)
  );
}

setInterval(pollInboundMessages, 5 * 60 * 1000);

console.log("Started polling MSG91 for inbound messages...");
