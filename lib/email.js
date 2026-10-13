import nodemailer from 'nodemailer';

/**
 * Sends complete chat transcript email to customer upon conversation resolution.
 * Sender: meetvariya1756@gmail.com
 */
export async function sendChatTranscriptEmail({
  to,
  shop,
  customerName = 'Valued Merchant',
  conversation,
  messages = [],
  attachments = []
}) {
  if (!to) {
    throw new Error('Customer email is required to send chat transcript.');
  }

  const fromEmail = process.env.EMAIL_FROM || 'meetvariya1756@gmail.com';
  const smtpUser = process.env.SMTP_USER || process.env.EMAIL_FROM || 'meetvariya1756@gmail.com';
  const smtpPass = process.env.SMTP_PASS || process.env.GMAIL_APP_PASSWORD || '';
  const smtpHost = process.env.SMTP_HOST || 'smtp.gmail.com';
  const smtpPort = parseInt(process.env.SMTP_PORT || '587', 10);

  // Format messages into HTML
  const messageRows = messages
    .map((msg) => {
      const isCustomer = msg.sender === 'customer';
      const isSystem = msg.sender === 'system';
      const senderLabel = isSystem
        ? 'System Notification'
        : isCustomer
        ? `${customerName || 'Customer'} (${shop || 'Store'})`
        : msg.senderName || 'Support Agent (Admin)';

      const timeStr = new Date(msg.createdAt).toLocaleString('en-US', {
        dateStyle: 'medium',
        timeStyle: 'short'
      });

      let contentHtml = '';
      if (msg.content) {
        contentHtml += `<p style="margin: 0 0 6px 0; font-size: 14px; line-height: 1.5; color: #1e293b;">${escapeHtml(
          msg.content
        )}</p>`;
      }

      if (msg.fileUrl) {
        contentHtml += `
          <div style="margin-top: 6px; padding: 8px 12px; background: rgba(0,0,0,0.03); border-radius: 6px; border: 1px solid #e2e8f0; font-size: 13px;">
            <strong>📎 Attachment:</strong> <a href="${msg.fileUrl}" style="color: #4f46e5; text-decoration: underline;" target="_blank">${escapeHtml(
          msg.fileName || 'View Attachment'
        )}</a> (${msg.fileMime || 'File'})
          </div>`;
      }

      const bubbleBg = isSystem
        ? '#f1f5f9'
        : isCustomer
        ? '#e0f2fe'
        : '#fef3c7';
      const borderCol = isSystem
        ? '#cbd5e1'
        : isCustomer
        ? '#7dd3fc'
        : '#fcd34d';

      return `
        <div style="margin-bottom: 14px; padding: 12px 16px; background-color: ${bubbleBg}; border-left: 4px solid ${borderCol}; border-radius: 6px;">
          <div style="font-size: 12px; font-weight: 700; color: #475569; margin-bottom: 4px; display: flex; justify-content: space-between;">
            <span>${escapeHtml(senderLabel)}</span>
            <span style="font-weight: 400; color: #94a3b8;">${timeStr}</span>
          </div>
          ${contentHtml}
        </div>`;
    })
    .join('');

  const htmlBody = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Collections Exporter Support Transcript</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px; color: #0f172a; }
        .container { max-width: 650px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 14px rgba(0,0,0,0.06); border: 1px solid #e2e8f0; }
        .header { background: linear-gradient(135deg, #1e1b4b 0%, #312e81 100%); padding: 24px 32px; color: #ffffff; }
        .header h1 { margin: 0 0 6px 0; font-size: 20px; font-weight: 700; }
        .header p { margin: 0; font-size: 13px; color: #cbd5e1; }
        .meta-box { padding: 16px 32px; background: #f8fafc; border-bottom: 1px solid #e2e8f0; display: flex; flex-wrap: wrap; gap: 16px; font-size: 13px; color: #475569; }
        .meta-item { flex: 1 1 40%; }
        .meta-item strong { color: #1e293b; }
        .content { padding: 28px 32px; }
        .footer { padding: 20px 32px; background: #f1f5f9; border-top: 1px solid #e2e8f0; font-size: 12px; color: #64748b; text-align: center; }
        .badge { display: inline-block; padding: 2px 8px; border-radius: 12px; background: #dcfce7; color: #166534; font-size: 11px; font-weight: 700; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Collections Exporter — Support Transcript</h1>
          <p>Your support query has been marked as <strong>Resolved</strong>.</p>
        </div>
        
        <div class="meta-box">
          <div class="meta-item">
            <strong>Store:</strong> ${escapeHtml(shop || 'N/A')}
          </div>
          <div class="meta-item">
            <strong>Customer:</strong> ${escapeHtml(customerName || 'N/A')} (${escapeHtml(to)})
          </div>
          <div class="meta-item">
            <strong>Support Mode:</strong> ${escapeHtml(conversation.supportType || 'chat').toUpperCase()}
          </div>
          <div class="meta-item">
            <strong>Status:</strong> <span class="badge">RESOLVED</span>
          </div>
          <div class="meta-item">
            <strong>Resolved Date:</strong> ${new Date().toLocaleString('en-US')}
          </div>
        </div>

        <div class="content">
          <h2 style="font-size: 15px; margin: 0 0 16px 0; color: #334155; text-transform: uppercase; letter-spacing: 0.5px;">
            Conversation History (${messages.length} messages)
          </h2>
          ${messageRows || '<p style="color: #94a3b8; font-style: italic;">No messages recorded in this conversation.</p>'}
        </div>

        <div class="footer">
          <p style="margin: 0 0 6px 0;">This email was automatically generated and sent from <strong>${escapeHtml(fromEmail)}</strong>.</p>
          <p style="margin: 0; color: #94a3b8;">In accordance with our privacy & data resolution policy, this conversation history and all associated files have been permanently cleared from our active database.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  let transporter;
  if (smtpPass) {
    // Real SMTP configuration
    transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465,
      auth: {
        user: smtpUser,
        pass: smtpPass
      }
    });
  } else {
    // If no SMTP password provided, simulate via test account / log
    try {
      const testAccount = await nodemailer.createTestAccount();
      transporter = nodemailer.createTransport({
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false,
        auth: {
          user: testAccount.user,
          pass: testAccount.pass
        }
      });
    } catch (_) {
      // JSON transport fallback for local development without internet/SMTP
      transporter = nodemailer.createTransport({
        jsonTransport: true
      });
    }
  }

  const mailOptions = {
    from: `"Collections Exporter Support" <${fromEmail}>`,
    to,
    replyTo: fromEmail,
    subject: `[Resolved] Support Transcript for ${shop || 'your Shopify Store'}`,
    html: htmlBody,
    text: `Your support inquiry for ${shop} has been resolved.\n\nSummary:\n- Customer: ${customerName} (${to})\n- Total Messages: ${messages.length}\n- Resolved Date: ${new Date().toLocaleString()}\n\nAll conversation history and files have been safely archived and deleted.`
  };

  const info = await transporter.sendMail(mailOptions);
  return {
    success: true,
    messageId: info.messageId,
    previewUrl: nodemailer.getTestMessageUrl ? nodemailer.getTestMessageUrl(info) : null,
    recipient: to
  };
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
