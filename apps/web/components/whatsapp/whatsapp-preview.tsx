"use client";

import {
  ExternalLink,
  Phone,
  Image,
  Video,
  FileText,
  MapPin,
} from "@repo/ui/icons";

export type TemplateComponent = {
  type: "HEADER" | "BODY" | "FOOTER" | "BUTTONS";
  format?: string;
  text?: string;
  buttons?: Array<{
    type: "QUICK_REPLY" | "URL" | "PHONE_NUMBER" | "COPY_CODE";
    text: string;
    url?: string;
    phone_number?: string;
  }>;
};

interface WhatsAppPreviewProps {
  components: TemplateComponent[];
  templateName?: string;
}

export function WhatsAppPreview({
  components,
  templateName,
}: WhatsAppPreviewProps) {
  const headerComponent = components.find(c => c.type === "HEADER");
  const bodyComponent = components.find(c => c.type === "BODY");
  const footerComponent = components.find(c => c.type === "FOOTER");
  const buttonsComponent = components.find(c => c.type === "BUTTONS");

  const formatText = (text: string | undefined) => {
    if (!text) return null;

    const formattedText = text;

    const parts = formattedText.split(
      /(\{\{\d+\}\}|\*[^*]+\*|_[^_]+_|~[^~]+~|```[^`]+```)/g
    );

    return parts.map((part, index) => {
      if (/\{\{\d+\}\}/.test(part)) {
        return (
          <span
            key={index}
            className="bg-[#dcf8c6] text-[#075e54] px-1 rounded font-medium"
          >
            {part}
          </span>
        );
      }

      if (/^\*[^*]+\*$/.test(part)) {
        return <strong key={index}>{part.slice(1, -1)}</strong>;
      }

      if (/^_[^_]+_$/.test(part)) {
        return <em key={index}>{part.slice(1, -1)}</em>;
      }

      if (/^~[^~]+~$/.test(part)) {
        return <s key={index}>{part.slice(1, -1)}</s>;
      }

      if (/^```[^`]+```$/.test(part)) {
        return (
          <code
            key={index}
            className="bg-active px-1 rounded font-mono text-sm"
          >
            {part.slice(3, -3)}
          </code>
        );
      }
      return part;
    });
  };

  const hasContent =
    headerComponent ||
    bodyComponent?.text ||
    footerComponent?.text ||
    buttonsComponent?.buttons?.length;

  const renderMediaHeader = () => {
    if (
      !headerComponent?.format ||
      headerComponent.format === "TEXT" ||
      headerComponent.format === "NONE"
    ) {
      return null;
    }

    const format = headerComponent.format;

    return (
      <div className="bg-active rounded-t-lg flex items-center justify-center h-32">
        {format === "IMAGE" && (
          <div className="text-center text-muted-foreground">
            <Image className="w-8 h-8 mx-auto mb-1" />
            <span className="text-xs">Image</span>
          </div>
        )}
        {format === "VIDEO" && (
          <div className="text-center text-muted-foreground">
            <Video className="w-8 h-8 mx-auto mb-1" />
            <span className="text-xs">Video</span>
          </div>
        )}
        {format === "DOCUMENT" && (
          <div className="text-center text-muted-foreground">
            <FileText className="w-8 h-8 mx-auto mb-1" />
            <span className="text-xs">Document</span>
          </div>
        )}
        {format === "LOCATION" && (
          <div className="text-center text-muted-foreground">
            <MapPin className="w-8 h-8 mx-auto mb-1" />
            <span className="text-xs">Location</span>
          </div>
        )}
      </div>
    );
  };

  const hasMediaHeader =
    headerComponent?.format &&
    ["IMAGE", "VIDEO", "DOCUMENT", "LOCATION"].includes(headerComponent.format);

  return (
    <div className="flex flex-col h-full">
      <div className="text-sm font-medium text-text-secondary mb-2">
        Preview
      </div>

      <div className="flex-1 bg-surface-secondary rounded-2xl p-2 min-h-[25rem] flex flex-col">
        <div className="bg-[#075e54] text-white px-4 py-3 rounded-t-xl flex items-center gap-3">
          <div className="w-8 h-8 bg-active rounded-full flex items-center justify-center">
            <span className="text-text-secondary text-xs font-bold">WA</span>
          </div>
          <div>
            <div className="font-medium text-sm">WhatsApp Business</div>
            <div className="text-xs text-success">online</div>
          </div>
        </div>

        <div
          className="flex-1 p-3 overflow-y-auto"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23d4d4d4' fill-opacity='0.4'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
            backgroundColor: "#e5ddd5",
          }}
        >
          {!hasContent ? (
            <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
              Start typing to see preview
            </div>
          ) : (
            <div className="flex justify-end">
              <div className="max-w-[85%]">
                <div
                  className={`bg-[#dcf8c6] shadow-sm overflow-hidden ${hasMediaHeader ? "rounded-lg" : "rounded-lg"}`}
                >
                  {renderMediaHeader()}

                  {headerComponent?.format === "TEXT" &&
                    headerComponent?.text && (
                      <div className="px-3 pt-2 pb-1 font-semibold text-[#303030] text-sm">
                        {formatText(headerComponent.text)}
                      </div>
                    )}

                  {bodyComponent?.text && (
                    <div className="px-3 py-1 text-[#303030] text-sm whitespace-pre-wrap">
                      {formatText(bodyComponent.text)}
                    </div>
                  )}

                  {footerComponent?.text && (
                    <div className="px-3 pb-2 pt-1 text-[#667781] text-xs">
                      {formatText(footerComponent.text)}
                    </div>
                  )}

                  <div className="px-3 pb-1 flex justify-end">
                    <span className="text-[0.625rem] text-[#667781]">
                      {new Date().toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                </div>

                {buttonsComponent?.buttons &&
                  buttonsComponent.buttons.length > 0 && (
                    <div className="mt-1 space-y-1">
                      {buttonsComponent.buttons.map((button, index) => (
                        <div
                          key={index}
                          className="bg-surface rounded-lg shadow-sm px-3 py-2 flex items-center justify-center gap-2 text-[#00a5f4] text-sm font-medium cursor-pointer hover:bg-surface-elevated"
                        >
                          {button.type === "URL" && (
                            <ExternalLink className="w-4 h-4" />
                          )}
                          {button.type === "PHONE_NUMBER" && (
                            <Phone className="w-4 h-4" />
                          )}
                          {button.type === "COPY_CODE" && (
                            <span className="w-4 h-4 text-xs">📋</span>
                          )}
                          {button.text || "Button"}
                        </div>
                      ))}
                    </div>
                  )}
              </div>
            </div>
          )}
        </div>

        <div className="bg-[#f0f0f0] px-2 py-2 rounded-b-xl flex items-center gap-2">
          <div className="flex-1 bg-surface rounded-full px-4 py-2 text-sm text-muted-foreground">
            Type a message
          </div>
          <div className="w-10 h-10 bg-[#075e54] rounded-full flex items-center justify-center">
            <svg
              className="w-5 h-5 text-white"
              fill="currentColor"
              viewBox="0 0 24 24"
            >
              <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
            </svg>
          </div>
        </div>
      </div>

      {templateName && (
        <div className="mt-2 text-xs text-muted-foreground text-center">
          Template: {templateName}
        </div>
      )}
    </div>
  );
}
