import nodemailer from 'nodemailer';
import { logger } from '../lib/logger';

const host = process.env.EMAIL_HOST || '';
const port = parseInt(process.env.EMAIL_PORT || '587');
const user = process.env.EMAIL_USER || '';
const pass = process.env.EMAIL_PASS || '';
const fromEmail = process.env.EMAIL_FROM || 'no-reply@cafeosz.com';

const isConfigured = !!(host && user && pass);

const transporter = isConfigured
  ? nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
    })
  : null;

export const EmailService = {
  /**
   * Send an email to a single recipient safely.
   */
  sendEmail: async (toEmail: string, subject: string, htmlContent: string, shopName: string): Promise<boolean> => {
    if (!isConfigured || !transporter) {
      // In Dev mode without SMTP, just log it out and pretend success
      logger.info(`[EMAIL MOCK] To: ${toEmail} | Subject: ${subject} | Shop: ${shopName}`);
      return true;
    }

    try {
      await transporter.sendMail({
        from: `"${shopName}" <${fromEmail}>`,
        to: toEmail,
        subject,
        html: htmlContent,
      });
      return true;
    } catch (err: any) {
      logger.error(`[EMAIL FAILED] To: ${toEmail} | Error: ${err.message}`);
      return false;
    }
  },
  /**
   * Send a beautiful Weekly Growth Report to the Shop Owner
   */
  sendWeeklyReport: async (shopName: string, toEmail: string, kpis: any) => {
    const growthEmoji = (kpis.revenue.growthPct >= 0) ? '📈' : '📉';
    const growthColor = (kpis.revenue.growthPct >= 0) ? '#10b981' : '#ef4444';

    const html = `
      <div style="font-family: Arial, sans-serif; color: #1e293b; max-width: 600px; margin: auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
        <div style="background: linear-gradient(135deg, #7c3aed, #3b82f6); padding: 32px; color: white; text-align: center;">
          <h1 style="margin: 0; font-size: 24px;">Your Weekly Growth Engine Report</h1>
          <p style="margin: 8px 0 0; opacity: 0.9;">${shopName} · Insights for the last 7 days</p>
        </div>
        
        <div style="padding: 24px;">
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 24px;">
            <div style="background: #f8fafc; padding: 16px; border-radius: 8px; border: 1px solid #f1f5f9;">
              <div style="font-size: 11px; color: #64748b; font-weight: bold; text-transform: uppercase;">Weekly Revenue</div>
              <div style="font-size: 20px; font-weight: 800; color: #7c3aed;">₹${kpis.revenue.thisWeek.toLocaleString()}</div>
              <div style="font-size: 12px; color: ${growthColor}; margin-top: 4px;">${growthEmoji} ${Math.abs(kpis.revenue.growthPct)}% vs last week</div>
            </div>
            <div style="background: #f8fafc; padding: 16px; border-radius: 8px; border: 1px solid #f1f5f9;">
              <div style="font-size: 11px; color: #64748b; font-weight: bold; text-transform: uppercase;">Repeat Rate</div>
              <div style="font-size: 20px; font-weight: 800; color: #3b82f6;">${kpis.customers.repeatRate.toFixed(1)}%</div>
              <div style="font-size: 12px; color: #64748b; margin-top: 4px;">Health: ${kpis.customers.repeatRate >= 25 ? 'Healthy' : 'Needs attention'}</div>
            </div>
          </div>

          <h3 style="font-size: 16px; margin-bottom: 12px; color: #0f172a; border-bottom: 2px solid #7c3aed; padding-bottom: 8px; display: inline-block;">🚀 AI Action Items</h3>
          <div style="color: #475569; font-size: 14px; line-height: 1.6; margin-bottom: 24px;">
            <ul style="padding-left: 18px;">
              <li>Target your <b>${kpis.customers.inactive30d} inactive customers</b> with a win-back offer.</li>
              <li>Your top seller is <b>${kpis.products.topItems[0]?.name || 'the menu'}</b>. Keep it up!</li>
              <li>Consider a special for <b>${kpis.products.lowItems[0]?.name || 'low sellers'}</b> to clear inventory.</li>
            </ul>
          </div>

          <div style="text-align: center;">
            <a href="https://cafe-osz.com/dashboard/growth" style="background: #7c3aed; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 14px; display: inline-block;">Open Growth Engine Dashboard</a>
          </div>
        </div>

        <div style="background: #f1f5f9; padding: 16px; text-align: center; font-size: 12px; color: #94a3b8;">
          &copy; 2026 Cafe OS - Powered by ShopOS Growth AI
        </div>
      </div>
    `;

    return EmailService.sendEmail(toEmail, `Weekly Performance Report: ${shopName}`, html, 'Cafe OS Intelligence');
  },

  /**
   * Send a Magic Login Link email
   */
  sendMagicLink: async (name: string, toEmail: string, loginUrl: string): Promise<boolean> => {
    const html = `
      <div style="font-family: Arial, sans-serif; color: #1e293b; max-width: 540px; margin: auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
        <div style="background: linear-gradient(135deg, #7c3aed, #3b82f6); padding: 28px; color: white; text-align: center;">
          <h1 style="margin: 0; font-size: 22px;">Your Magic Login Link</h1>
          <p style="margin: 8px 0 0; opacity: 0.9;">Cafe OS — Tap to sign in instantly</p>
        </div>
        <div style="padding: 28px;">
          <p style="font-size: 15px; margin-bottom: 20px;">Hi ${name},</p>
          <p style="font-size: 14px; color: #475569; margin-bottom: 24px;">Click the button below to log in. This link expires in <b>15 minutes</b> and can only be used once.</p>
          <div style="text-align: center; margin-bottom: 24px;">
            <a href="${loginUrl}" style="background: linear-gradient(135deg, #7c3aed, #3b82f6); color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 16px; display: inline-block;">Sign In to Cafe OS</a>
          </div>
          <p style="font-size: 12px; color: #94a3b8; text-align: center;">If you didn't request this, you can safely ignore this email.</p>
        </div>
      </div>
    `;
    return EmailService.sendEmail(toEmail, 'Your Cafe OS Magic Login Link', html, 'Cafe OS');
  },

  /**
   * Send a Password Reset email
   */
  sendPasswordReset: async (name: string, toEmail: string, resetUrl: string): Promise<boolean> => {
    const html = `
      <div style="font-family: Arial, sans-serif; color: #1e293b; max-width: 540px; margin: auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
        <div style="background: linear-gradient(135deg, #dc2626, #9333ea); padding: 28px; color: white; text-align: center;">
          <h1 style="margin: 0; font-size: 22px;">Reset Your Password</h1>
          <p style="margin: 8px 0 0; opacity: 0.9;">Cafe OS — Account Recovery</p>
        </div>
        <div style="padding: 28px;">
          <p style="font-size: 15px; margin-bottom: 16px;">Hi ${name},</p>
          <p style="font-size: 14px; color: #475569; margin-bottom: 24px;">
            We received a request to reset your Cafe OS password. Click the button below to choose a new password.
            This link expires in <b>1 hour</b>.
          </p>
          <div style="text-align: center; margin-bottom: 24px;">
            <a href="${resetUrl}" style="background: linear-gradient(135deg, #dc2626, #9333ea); color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 16px; display: inline-block;">Reset My Password</a>
          </div>
          <p style="font-size: 12px; color: #94a3b8; text-align: center;">
            If you didn't request a password reset, you can safely ignore this email. Your password will not change.
          </p>
        </div>
        <div style="background: #f1f5f9; padding: 14px; text-align: center; font-size: 12px; color: #94a3b8;">
          &copy; 2026 Cafe OS
        </div>
      </div>
    `;
    return EmailService.sendEmail(toEmail, 'Reset Your Cafe OS Password', html, 'Cafe OS');
  }
};
