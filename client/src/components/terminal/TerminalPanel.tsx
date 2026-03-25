import React, { useEffect, useRef, useCallback } from 'react';
import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import '@xterm/xterm/css/xterm.css';
import { TerminalMessage } from '@/hooks/useRunWs';

interface TerminalPanelProps {
  externalMessages: TerminalMessage[];
  height: number;
  /** Called when the user types in the terminal (stdin relay) */
  onInput?: (data: string) => void;
}

export default function TerminalPanel({ externalMessages, height, onInput }: TerminalPanelProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<XTerm | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const processedRef = useRef(0);
  const onInputRef = useRef(onInput);
  onInputRef.current = onInput;

  const initTerm = useCallback(() => {
    if (!containerRef.current || termRef.current) return;

    const term = new XTerm({
      theme: {
        background: '#0d0e11',
        foreground: '#e3e2e6',
        cursor: '#adc7ff',
        cursorAccent: '#0d0e11',
        black: '#000000',
        red: '#ffb4ab',
        green: '#d7ffc5',
        yellow: '#ffb59e',
        blue: '#adc7ff',
        magenta: '#c586c0',
        cyan: '#4ec9b0',
        white: '#e3e2e6',
        brightBlack: '#8b90a0',
        brightRed: '#ffb4ab',
        brightGreen: '#79ff5b',
        brightYellow: '#ffdbd0',
        brightBlue: '#adc7ff',
        brightMagenta: '#c586c0',
        brightCyan: '#4ec9b0',
        brightWhite: '#ffffff',
        selectionBackground: 'rgba(74,142,255,0.3)',
      },
      fontFamily: "'JetBrains Mono', 'Fira Code', Cascadia Code, monospace",
      fontSize: 13,
      lineHeight: 1.5,
      cursorBlink: true,
      cursorStyle: 'bar',
      allowTransparency: true,
      scrollback: 5000,
      convertEol: true,
      // Allow terminal to receive focus & input
      disableStdin: false,
    });

    const fitAddon = new FitAddon();
    const webLinksAddon = new WebLinksAddon();
    term.loadAddon(fitAddon);
    term.loadAddon(webLinksAddon);

    term.open(containerRef.current);
    fitAddon.fit();

    // ── KEY FIX: relay keyboard input back to running process ──
    term.onData((data: string) => {
      onInputRef.current?.(data);
    });

    term.writeln('\x1b[1;34m Nexus Code Terminal \x1b[0m');
    term.writeln('\x1b[90mPress ▶ Run to execute code. Input is relayed to stdin.\x1b[0m');
    term.writeln('');

    termRef.current = term;
    fitAddonRef.current = fitAddon;

    // Focus so the terminal captures keys immediately
    term.focus();
  }, []);

  useEffect(() => {
    initTerm();
    return () => {
      termRef.current?.dispose();
      termRef.current = null;
      fitAddonRef.current = null;
      processedRef.current = 0;
    };
  }, [initTerm]);

  // Resize terminal when panel height changes
  useEffect(() => {
    const timer = setTimeout(() => {
      fitAddonRef.current?.fit();
    }, 50);
    return () => clearTimeout(timer);
  }, [height]);

  // Process new messages from server
  useEffect(() => {
    const term = termRef.current;
    if (!term) return;

    const newMessages = externalMessages.slice(processedRef.current);
    processedRef.current = externalMessages.length;

    newMessages.forEach((msg) => {
      if (msg.type === 'output' && msg.data) {
        term.write(msg.data);
      } else if (msg.type === 'done') {
        const code = msg.exitCode ?? 0;
        const color = code === 0 ? '\x1b[32m' : '\x1b[31m';
        term.writeln(`\r\n${color}Process exited with code ${code}\x1b[0m`);
        term.writeln('\x1b[90m──────────────────────────────────────────\x1b[0m');
        term.write('\x1b[90m$ \x1b[0m');
      } else if (msg.type === 'error') {
        term.writeln(`\r\n\x1b[31m✗ ${msg.message}\x1b[0m`);
      }
    });
  }, [externalMessages]);

  const clearTerminal = () => {
    if (termRef.current) {
      termRef.current.clear();
      termRef.current.write('\x1b[90m$ \x1b[0m');
      processedRef.current = 0;
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#0d0e11]">
      {/* Terminal header */}
      <div className="flex items-center justify-between px-md py-[3px] border-b border-outline-variant flex-shrink-0">
        <div className="flex items-center gap-sm">
          <span className="material-symbols-outlined text-[14px] text-on-surface-variant">terminal</span>
          <span className="label-caps text-on-surface-variant">Terminal</span>
        </div>
        <button
          id="clear-terminal-btn"
          onClick={clearTerminal}
          className="label-caps text-outline hover:text-on-surface transition-colors px-2 py-0.5 rounded hover:bg-surface-variant"
        >
          Clear
        </button>
      </div>
      {/* xterm container — must be focusable */}
      <div
        ref={containerRef}
        className="flex-1 overflow-hidden px-1 pt-1"
        onClick={() => termRef.current?.focus()}
      />
    </div>
  );
}
