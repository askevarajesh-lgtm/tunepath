const sendpulse = require('sendpulse-api');

const initSendPulseWithCredentials = (clientId, clientSecret) => {
  const cId = clientId || process.env.SENDPULSE_CLIENT_ID;
  const cSecret = clientSecret || process.env.SENDPULSE_CLIENT_SECRET;

  if (!cId || !cSecret) {
    return Promise.reject(
      new Error("SendPulse API Client ID and Client Secret are required."),
    );
  }

  return new Promise((resolve, reject) => {
    sendpulse.init(cId, cSecret, "/tmp/", (token) => {
      if (token && token.is_error) {
        reject(
          new Error(
            "SendPulse connection failed: " +
              (token.message || JSON.stringify(token)),
          ),
        );
      } else {
        resolve(token);
      }
    });
  });
};

exports.testConnection = async (credentials = {}) => {
  const { clientId, clientSecret } = credentials;
  return await initSendPulseWithCredentials(clientId, clientSecret);
};

exports.sendEmail = async (toArg, subjectArg, htmlArg, textArg, extraOpts = {}) => {
  let to, subject, html, text, fromName, fromEmail, clientId, clientSecret;
  if (typeof toArg === "object" && toArg !== null) {
    ({ to, subject, html, text, fromName, fromEmail, clientId, clientSecret } =
      toArg);
  } else {
    to = toArg;
    subject = subjectArg;
    html = htmlArg;
    text = textArg;
    ({ fromName, fromEmail, clientId, clientSecret } = extraOpts);
  }

  await initSendPulseWithCredentials(clientId, clientSecret);

  return new Promise((resolve, reject) => {
    const emailParams = {
      html: html || `<p>${text || subject || ""}</p>`,
      text: text || subject || "",
      subject: subject || "Notification",
      from: {
        name:
          fromName ||
          process.env.SENDPULSE_FROM_NAME ||
          "Tunepath Technologies",
        email:
          fromEmail || process.env.SENDPULSE_FROM_EMAIL || "dev@askeva.io",
      },
      to: [
        {
          email: to,
        },
      ],
    };

    sendpulse.smtpSendMail((response) => {
      if (response && response.is_error) {
        console.error("SendPulse error:", response);
        reject(
          new Error(response.message || "Failed to send email via SendPulse"),
        );
      } else {
        resolve(response);
      }
    }, emailParams);
  });
};

exports.sendOtpEmail = async (toEmail, otp) => {
  try {
    return await exports.sendEmail({
      to: toEmail,
      subject: "Password Reset OTP",
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px;">
          <h2>Password Reset Request</h2>
          <p>You have requested to reset your password. Use the OTP below to proceed.</p>
          <h1 style="background: #f4f4f4; padding: 10px; display: inline-block; letter-spacing: 5px;">${otp}</h1>
          <p>This OTP will expire in 10 minutes.</p>
          <p>If you did not request a password reset, please ignore this email.</p>
        </div>
      `,
      text: `Your password reset OTP is ${otp}. It will expire in 10 minutes.`,
    });
  } catch (error) {
    console.error("Error in sendOtpEmail:", error);
    throw error;
  }
};
