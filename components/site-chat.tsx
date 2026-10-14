'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ArrowUp, ChevronDown, Plus, Square } from 'lucide-react';
import { correctSiteName } from '@/lib/chat/text';
import { readSse } from '@/lib/chat/stream';
import type { Message } from '@/lib/chat/types';
const storageKey = 'jiuheng-chat-v1';
export function SiteChat() {
  const path = usePathname();
  const visible = !path.startsWith('/admin');
  const [open, setOpen] = useState(false),
    [messages, setMessages] = useState<Message[]>([]),
    [input, setInput] = useState('');
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [ready, setReady] = useState(false);
  const root = useRef<HTMLDivElement>(null),
    log = useRef<HTMLDivElement>(null),
    textarea = useRef<HTMLTextAreaElement>(null);
  const session = useRef(''),
    generation = useRef(''),
    cancellation = useRef<Promise<unknown> | null>(null),
    abort = useRef<AbortController | null>(null),
    composing = useRef(false),
    follow = useRef(true);
  const enterTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const leaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pointerInside = useRef(false),
    hoverEnabled = useRef(false);
  const suppressed = useRef(false),
    focusOnOpen = useRef(false);
  const clearTimers = useCallback(() => {
    if (enterTimer.current) clearTimeout(enterTimer.current);
    if (leaveTimer.current) clearTimeout(leaveTimer.current);
  }, []);
  const scheduleCollapse = useCallback(() => {
    if (leaveTimer.current) clearTimeout(leaveTimer.current);
    if (!hoverEnabled.current || pointerInside.current) return;
    leaveTimer.current = setTimeout(() => {
      if (
        !pointerInside.current &&
        !abort.current &&
        !composing.current &&
        !root.current?.contains(document.activeElement)
      )
        setOpen(false);
    }, 600);
  }, []);
  const collapse = useCallback(() => {
    clearTimers();
    suppressed.current = pointerInside.current;
    focusOnOpen.current = false;
    if (root.current?.contains(document.activeElement))
      (document.activeElement as HTMLElement)?.blur();
    setOpen(false);
  }, [clearTimers]);
  useEffect(() => clearTimers, [clearTimers]);
  useEffect(() => {
    if (open && focusOnOpen.current) {
      focusOnOpen.current = false;
      textarea.current?.focus();
    }
  }, [open]);
  useEffect(() => {
    session.current = crypto.randomUUID();
    try {
      const data = JSON.parse(sessionStorage.getItem(storageKey) || 'null');
      if (
        data &&
        Array.isArray(data.messages) &&
        data.messages.length <= 40 &&
        data.messages.every(
          (m: Message) =>
            ['user', 'assistant'].includes(m.role) &&
            typeof m.content === 'string' &&
            m.content.length <= 16000,
        )
      ) {
        queueMicrotask(() =>
          setMessages(
            data.messages.map((m: Message) => ({
              ...m,
              content:
                m.role === 'assistant' ? correctSiteName(m.content) : m.content,
              sources: Array.isArray(m.sources)
                ? m.sources.filter(
                    (s) =>
                      s &&
                      typeof s.title === 'string' &&
                      typeof s.href === 'string' &&
                      /^\/(blog|work)\/[\w%-]+$/.test(s.href),
                  )
                : undefined,
            })),
          ),
        );
        if (typeof data.input === 'string')
          queueMicrotask(() => setInput(data.input.slice(0, 2000)));
        if (typeof data.session === 'string') session.current = data.session;
      }
    } catch {}
    queueMicrotask(() => setReady(true));
    return () => abort.current?.abort();
  }, []);
  useEffect(() => {
    if (ready)
      try {
        sessionStorage.setItem(
          storageKey,
          JSON.stringify({
            messages: messages.slice(-40),
            input,
            session: session.current,
          }),
        );
      } catch {}
  }, [messages, input, ready]);
  useEffect(() => {
    document.body.classList.toggle('has-site-chat', visible);
    document.body.classList.toggle('site-chat-expanded', visible && open);
    return () => {
      document.body.classList.remove('has-site-chat');
      document.body.classList.remove('site-chat-expanded');
    };
  }, [visible, open]);
  useEffect(() => {
    const viewport = window.visualViewport;
    const update = () => {
      root.current?.style.setProperty(
        '--chat-keyboard',
        `${Math.max(0, window.innerHeight - (viewport?.height ?? window.innerHeight) - (viewport?.offsetTop ?? 0))}px`,
      );
      root.current?.style.setProperty(
        '--chat-height',
        `${(viewport?.height ?? window.innerHeight) * 0.7}px`,
      );
    };
    update();
    viewport?.addEventListener('resize', update);
    viewport?.addEventListener('scroll', update);
    return () => {
      viewport?.removeEventListener('resize', update);
      viewport?.removeEventListener('scroll', update);
    };
  }, [visible]);
  useEffect(() => {
    const outside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) collapse();
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        collapse();
      }
    };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('keydown', escape);
    };
  }, [collapse]);
  useEffect(() => {
    if (follow.current && log.current)
      log.current.scrollTop = log.current.scrollHeight;
  }, [messages, open]);
  async function send(retry = false) {
    if (abort.current || !ready) return;
    if (cancellation.current) await cancellation.current.catch(() => {});
    if (abort.current) return;
    const lastUser = messages.findLastIndex((m) => m.role === 'user');
    const question =
      retry && lastUser >= 0 ? messages[lastUser].content : input.trim();
    if (!question) return;
    const base = retry ? messages.slice(0, lastUser) : messages;
    const history = base
      .filter((m) => !m.interrupted)
      .slice(-20)
      .map(({ role, content }) => ({ role, content }));
    while (JSON.stringify(history).length + question.length > 24000)
      history.splice(0, 2);
    const current: Message[] = [
      ...base,
      { role: 'user', content: question },
      { role: 'assistant', content: '', interrupted: true },
    ];
    const controller = new AbortController();
    abort.current = controller;
    generation.current = crypto.randomUUID();
    setBusy(true);
    setError('');
    setOpen(true);
    setMessages(current);
    setInput('');
    follow.current = true;
    let complete = false;
    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question,
          history,
          path,
          session: session.current,
          generation: generation.current,
        }),
        signal: controller.signal,
      });
      if (!response.ok)
        throw new Error((await response.json()).error || '发送失败，请重试');
      if (!response.body) throw new Error('没有收到回答，请重试');
      for await (const data of readSse(response.body)) {
        const event = JSON.parse(data),
          answer = current[current.length - 1];
        if (event.type === 'sources') answer.sources = event.sources;
        if (event.type === 'delta')
          answer.content = correctSiteName(answer.content + event.text);
        if (event.type === 'error') throw new Error(event.error);
        if (event.type === 'done') {
          complete = true;
          answer.interrupted = false;
        }
        setMessages(current.map((m) => ({ ...m })));
      }
      if (!complete) throw new Error('回答中断，请重试');
    } catch (failure) {
      setInput((previous) => previous || question);
      setError(
        controller.signal.aborted
          ? '已停止生成，可重试或继续提问。'
          : failure instanceof Error
            ? failure.message
            : '发送失败，请重试',
      );
    } finally {
      abort.current = null;
      setBusy(false);
      scheduleCollapse();
    }
  }
  if (!visible) return null;
  return (
    <div
      ref={root}
      className={`site-chat ${open ? 'is-open' : ''}`}
      aria-label="AI 聊天"
      onPointerEnter={(event) => {
        if (
          event.pointerType !== 'mouse' ||
          !window.matchMedia('(hover: hover) and (pointer: fine)').matches
        )
          return;
        hoverEnabled.current = true;
        pointerInside.current = true;
        clearTimers();
        if (!suppressed.current)
          enterTimer.current = setTimeout(() => setOpen(true), 120);
      }}
      onPointerLeave={(event) => {
        if (event.pointerType !== 'mouse') return;
        pointerInside.current = false;
        suppressed.current = false;
        clearTimers();
        scheduleCollapse();
      }}
      onFocusCapture={() => {
        if (leaveTimer.current) clearTimeout(leaveTimer.current);
      }}
      onBlurCapture={scheduleCollapse}
    >
      {open && messages.length > 0 && (
        <section className="chat-panel" aria-label="聊天面板">
          <header className="chat-header">
            <div className="chat-actions">
              <button
                type="button"
                disabled={busy}
                title="新建对话"
                aria-label="新建对话"
                onClick={() => {
                  setMessages([]);
                  setInput('');
                  setError('');
                  session.current = crypto.randomUUID();
                }}
              >
                <Plus size={19} />
              </button>
              <button type="button" aria-label="收起聊天" onClick={collapse}>
                <ChevronDown size={20} />
              </button>
            </div>
          </header>
          <div
            className="chat-messages"
            ref={log}
            role="log"
            aria-label="对话记录"
            onScroll={() => {
              const el = log.current!;
              follow.current =
                el.scrollHeight - el.scrollTop - el.clientHeight < 70;
            }}
          >
            {messages.map((m, i) => (
              <article key={i} className={`chat-message ${m.role}`}>
                <div className="chat-message-body">
                  <Markdown
                    remarkPlugins={[remarkGfm]}
                    skipHtml
                    components={{
                      img: () => null,
                      a: ({ children }) => <span>{children}</span>,
                    }}
                  >
                    {m.content ||
                      (busy && i === messages.length - 1
                        ? '正在思考…'
                        : '回答已中断')}
                  </Markdown>
                  {!!m.sources?.length && (
                    <div className="chat-sources">
                      <span>相关来源</span>
                      {m.sources.map((s) => (
                        <a href={s.href} key={s.id}>
                          [{s.id}] {s.title}
                        </a>
                      ))}
                    </div>
                  )}
                  {m.interrupted && m.content && !busy && (
                    <small>此回答未完成</small>
                  )}
                </div>
              </article>
            ))}
          </div>
          {error && (
            <div className="chat-error" role="alert">
              {error}
              <button disabled={busy} onClick={() => void send(true)}>
                重试
              </button>
            </div>
          )}
        </section>
      )}
      {open ? (
        <form className="chat-composer" onSubmit={(e) => e.preventDefault()}>
          <textarea
            ref={textarea}
            rows={1}
            maxLength={2000}
            aria-label="聊天问题"
            placeholder="有什么想聊的？"
            value={input}
            onFocus={() => setOpen(true)}
            onChange={(e) => setInput(e.target.value)}
            onCompositionStart={() => (composing.current = true)}
            onCompositionEnd={() => {
              composing.current = false;
              scheduleCollapse();
            }}
            onKeyDown={(e) => {
              if (
                e.key === 'Enter' &&
                !e.shiftKey &&
                !e.nativeEvent.isComposing &&
                !composing.current
              ) {
                e.preventDefault();
                void send();
              }
            }}
          />
          {busy ? (
            <button
              type="button"
              className="chat-send"
              aria-label="停止生成"
              onClick={() => {
                abort.current?.abort();
                cancellation.current = fetch('/api/chat', {
                  method: 'DELETE',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    session: session.current,
                    generation: generation.current,
                  }),
                }).catch(() => {});
              }}
            >
              <Square size={17} fill="currentColor" />
            </button>
          ) : (
            <button
              type="button"
              className="chat-send"
              aria-label="发送"
              disabled={!input.trim() || !ready}
              onClick={() => void send()}
            >
              <ArrowUp size={23} />
            </button>
          )}
        </form>
      ) : (
        <button
          type="button"
          className="chat-launcher"
          aria-label="展开聊天"
          aria-expanded={false}
          onClick={() => {
            clearTimers();
            suppressed.current = false;
            focusOnOpen.current = true;
            setOpen(true);
          }}
        >
          问问 AI
        </button>
      )}
    </div>
  );
}
