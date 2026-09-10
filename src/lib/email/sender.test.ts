import { describe, expect, it, vi } from "vitest";
import {
  ContactEmailSender,
  createUnconfiguredEmailTransport,
  type EmailMessage,
  type EmailTransport,
} from "./sender";

const payload = {
  nombre: "<b>Ana</b> García",
  email: "ana@example.com",
  telefono: "+34 600 000 000",
  mensaje: "Consulta sobre <script>alert(1)</script> herencias & bienes \"familiares\"",
};

const config = { recipientEmail: "{{CONTACT_RECIPIENT_EMAIL}}" };

function createRecordingTransport() {
  const sendMock = vi.fn(async (_message: EmailMessage) => {});
  const transport: EmailTransport = { send: sendMock };
  return { transport, sendMock };
}

function firstMessage(sendMock: ReturnType<typeof createRecordingTransport>["sendMock"]): EmailMessage {
  const call = sendMock.mock.calls.at(0);
  if (!call) throw new Error("transport.send was not called");
  return call[0];
}

describe("ContactEmailSender", () => {
  it("HTML-escapes nombre, email, telefono, and mensaje in the sent message", async () => {
    const { transport, sendMock } = createRecordingTransport();
    const sender = new ContactEmailSender(transport, config);

    await sender.send(payload);

    expect(sendMock).toHaveBeenCalledTimes(1);
    const message = firstMessage(sendMock);
    expect(message.html).not.toContain("<script>");
    expect(message.html).toContain("&lt;b&gt;Ana&lt;/b&gt; García");
    expect(message.html).toContain(
      "Consulta sobre &lt;script&gt;alert(1)&lt;/script&gt; herencias &amp; bienes &quot;familiares&quot;",
    );
  });

  it("sends to the configured recipient with a subject and both html/text bodies", async () => {
    const { transport, sendMock } = createRecordingTransport();
    const sender = new ContactEmailSender(transport, config);

    await sender.send(payload);

    const message = firstMessage(sendMock);
    expect(message.to).toBe("{{CONTACT_RECIPIENT_EMAIL}}");
    expect(typeof message.subject).toBe("string");
    expect(message.subject.length).toBeGreaterThan(0);
    expect(message.text).toContain(payload.telefono);
    expect(message.text).toContain(payload.email);
  });

  it("returns a generic failure and does not throw when the transport rejects", async () => {
    const transport: EmailTransport = {
      send: vi.fn().mockRejectedValue(new Error("SMTP connection refused")),
    };
    const sender = new ContactEmailSender(transport, config);

    const result = await sender.send(payload);

    expect(result).toEqual({ success: false, reason: "send_failed" });
    expect(transport.send).toHaveBeenCalledTimes(1);
  });

  it("returns success on a confirmed delivery and sends exactly once (no duplicate/partial send)", async () => {
    const { transport, sendMock } = createRecordingTransport();
    const sender = new ContactEmailSender(transport, config);

    const result = await sender.send(payload);

    expect(result).toEqual({ success: true });
    expect(sendMock).toHaveBeenCalledTimes(1);
  });

  it("references the {{RETENTION_PERIOD}} placeholder in the rendered body, never an invented duration", async () => {
    const { transport, sendMock } = createRecordingTransport();
    const sender = new ContactEmailSender(transport, config);

    await sender.send(payload);

    const message = firstMessage(sendMock);
    expect(message.html).toContain("{{RETENTION_PERIOD}}");
  });

  it("the unconfigured transport placeholder always fails generically instead of fabricating success", async () => {
    const sender = new ContactEmailSender(createUnconfiguredEmailTransport(), config);

    const result = await sender.send(payload);

    expect(result).toEqual({ success: false, reason: "send_failed" });
  });
});
