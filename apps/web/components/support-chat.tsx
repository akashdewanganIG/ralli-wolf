"use client";

import * as React from "react";
import { MessageCircle, RefreshCw, X } from "@repo/ui/icons";
import { cn } from "@repo/ui/lib/utils";

interface CannedQuestion {
  id: string;
  question: string;
  answer: string;
}

/** Placeholder script: every answer here is written by hand, not generated. */
const QUESTIONS: CannedQuestion[] = [
  {
    id: "add-user",
    question: "How do I add a new user?",
    answer:
      "Administration → User Management → Add User. Fill in the name, email and role. Pick Custom as the role and you choose the exact permissions in the dialog that opens. The account is active immediately and the person gets an email invitation to set their own password.",
  },
  {
    id: "stock-levels",
    question: "Where do I check stock levels?",
    answer:
      "Inventory → Stock positions shows on hand, reserved and available quantity for each item and warehouse. Inventory → Stock ledger lists every posted movement behind those numbers.",
  },
  {
    id: "purchase-order",
    question: "How do I raise a purchase order?",
    answer:
      "Purchasing → Purchase orders, then create one. Choose the supplier, add the lines, and send it for approval. Once it is approved, deliveries are booked against it under Purchasing → Goods receipts.",
  },
  {
    id: "quote",
    question: "How do I create a quote?",
    answer:
      "Sales → Quotes, then create one. Pick the account, add products from the price book, and the discount rules decide whether it needs approval before it can go out.",
  },
  {
    id: "reorder",
    question: "What is a reorder policy?",
    answer:
      "A rule per item and warehouse holding a reorder point and a safety stock level. When available stock drops below the reorder point, the reorder check raises an alert and can open a purchase requisition on its own. Set them under Inventory → Reorder policies.",
  },
  {
    id: "export",
    question: "How do I export data?",
    answer:
      "Most list screens carry an Export action in the toolbar. It downloads the view you are looking at, filters included, as an Excel file.",
  },
];

const GREETING =
  "Hello. Pick a question below and I will point you to the right screen.";

interface Message {
  id: string;
  from: "bot" | "user";
  text: string;
}

const OPENING_MESSAGES: Message[] = [
  { id: "greeting", from: "bot", text: GREETING },
];

function TypingDots() {
  return (
    <span className="flex items-center gap-1 py-1">
      {[0, 1, 2].map(dot => (
        <span
          key={dot}
          className="size-1.5 animate-bounce rounded-full bg-muted-foreground/60"
          style={{ animationDelay: `${dot * 140}ms` }}
        />
      ))}
    </span>
  );
}

export function SupportChat() {
  const [open, setOpen] = React.useState(false);
  const [messages, setMessages] = React.useState<Message[]>(OPENING_MESSAGES);
  const [asked, setAsked] = React.useState<string[]>([]);
  const [typing, setTyping] = React.useState(false);

  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const panelRef = React.useRef<HTMLDivElement>(null);
  const transcriptRef = React.useRef<HTMLDivElement>(null);
  const timers = React.useRef<number[]>([]);

  React.useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach(window.clearTimeout);
  }, []);

  React.useEffect(() => {
    if (!open) return;

    panelRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  React.useEffect(() => {
    const transcript = transcriptRef.current;
    if (transcript) transcript.scrollTop = transcript.scrollHeight;
  }, [messages, typing, open]);

  const ask = (item: CannedQuestion) => {
    setAsked(current => [...current, item.id]);
    setMessages(current => [
      ...current,
      { id: `${item.id}-q`, from: "user", text: item.question },
    ]);
    setTyping(true);

    const timer = window.setTimeout(() => {
      setMessages(current => [
        ...current,
        { id: `${item.id}-a`, from: "bot", text: item.answer },
      ]);
      setTyping(false);
    }, 650);

    timers.current.push(timer);
  };

  const reset = () => {
    timers.current.forEach(window.clearTimeout);
    timers.current = [];
    setMessages(OPENING_MESSAGES);
    setAsked([]);
    setTyping(false);
  };

  const close = () => {
    setOpen(false);
    triggerRef.current?.focus();
  };

  const remaining = QUESTIONS.filter(item => !asked.includes(item.id));

  return (
    <div className="fixed bottom-4 right-4 z-40 flex flex-col items-end gap-3 sm:bottom-6 sm:right-6">
      {open ? (
        <div
          ref={panelRef}
          role="dialog"
          aria-label="Help assistant"
          tabIndex={-1}
          className={cn(
            "flex h-[min(31rem,calc(100svh-7.5rem))] w-[min(23rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-border bg-surface outline-none",
            "shadow-[0_24px_48px_-16px_rgb(0_0_0/0.28),0_8px_16px_-8px_rgb(0_0_0/0.16)]",
            "origin-bottom-right animate-in fade-in-0 zoom-in-95 slide-in-from-bottom-4 duration-200 ease-out"
          )}
        >
          <div className="flex shrink-0 items-center gap-3 border-b border-border bg-primary-surface px-4 py-3">
            <span className="relative flex size-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
              <MessageCircle className="size-[1.125rem]" />
              <span className="absolute -bottom-0.5 -right-0.5 size-3 rounded-full border-2 border-primary-surface bg-success" />
            </span>

            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-foreground">
                Help assistant
              </p>
              <p className="mt-0.5 truncate text-[0.6875rem] text-muted-foreground">
                Replies instantly · demo answers
              </p>
            </div>

            {asked.length > 0 ? (
              <button
                type="button"
                onClick={reset}
                aria-label="Start over"
                title="Start over"
                className="inline-flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground outline-none transition-colors hover:bg-surface hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/30"
              >
                <RefreshCw className="size-3.5" />
              </button>
            ) : null}

            <button
              type="button"
              onClick={close}
              aria-label="Close help assistant"
              className="inline-flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground outline-none transition-colors hover:bg-surface hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/30"
            >
              <X className="size-3.5" />
            </button>
          </div>

          <div
            ref={transcriptRef}
            className="min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain bg-surface-subtle px-3.5 py-3.5"
          >
            {messages.map(message => (
              <div
                key={message.id}
                className={cn(
                  "flex animate-in fade-in-0 slide-in-from-bottom-1 duration-200",
                  message.from === "user" ? "justify-end" : "justify-start"
                )}
              >
                <p
                  className={cn(
                    "max-w-[86%] px-3 py-2 text-[0.8125rem] leading-[1.45]",
                    message.from === "user"
                      ? "rounded-2xl rounded-br-md bg-primary text-primary-foreground"
                      : "rounded-2xl rounded-bl-md border border-border bg-surface text-foreground shadow-sm shadow-foreground/[0.03]"
                  )}
                >
                  {message.text}
                </p>
              </div>
            ))}

            {typing ? (
              <div className="flex justify-start">
                <span className="rounded-2xl rounded-bl-md border border-border bg-surface px-3 py-2 shadow-sm shadow-foreground/[0.03]">
                  <TypingDots />
                </span>
              </div>
            ) : null}
          </div>

          <div className="shrink-0 border-t border-border bg-surface px-3.5 py-3">
            {remaining.length > 0 ? (
              <>
                <p className="pb-2 text-[0.625rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                  Suggested questions
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {remaining.map(item => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => ask(item)}
                      disabled={typing}
                      className="rounded-full border border-border bg-surface px-3 py-1.5 text-xs font-medium text-foreground outline-none transition-[background-color,border-color,color] duration-150 hover:border-primary/40 hover:bg-primary-surface hover:text-primary-surface-foreground focus-visible:ring-2 focus-visible:ring-ring/30 disabled:pointer-events-none disabled:opacity-50"
                    >
                      {item.question}
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <p className="text-xs leading-5 text-muted-foreground">
                That is everything in the script for now. Start over to run
                through them again, or ask your administrator.
              </p>
            )}
          </div>
        </div>
      ) : null}

      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(current => !current)}
        aria-expanded={open}
        aria-label={open ? "Close help assistant" : "Open help assistant"}
        className={cn(
          "group inline-flex h-12 items-center gap-2 rounded-full bg-primary text-primary-foreground outline-none ring-4 ring-primary/10",
          "shadow-[0_10px_24px_-8px_rgb(0_0_0/0.35)] transition-[background-color,box-shadow,transform] duration-150",
          "hover:-translate-y-0.5 hover:shadow-[0_14px_28px_-8px_rgb(0_0_0/0.4)] focus-visible:ring-primary/40 active:translate-y-0 active:scale-95",
          open ? "w-12 justify-center" : "pl-3.5 pr-4"
        )}
      >
        {open ? (
          <X className="size-5" />
        ) : (
          <>
            <MessageCircle className="size-5 shrink-0" />
            <span className="text-[0.8125rem] font-semibold">Need help?</span>
          </>
        )}
      </button>
    </div>
  );
}
