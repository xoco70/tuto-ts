import { useEffect, useMemo, useRef } from 'react';
import { marked } from 'marked';
import hljs from 'highlight.js/lib/core';
import typescript from 'highlight.js/lib/languages/typescript';
import javascript from 'highlight.js/lib/languages/javascript';
import bash from 'highlight.js/lib/languages/bash';
import json from 'highlight.js/lib/languages/json';
import xml from 'highlight.js/lib/languages/xml';
import sql from 'highlight.js/lib/languages/sql';
import yaml from 'highlight.js/lib/languages/yaml';
import dockerfile from 'highlight.js/lib/languages/dockerfile';
import http from 'highlight.js/lib/languages/http';

hljs.registerLanguage('typescript', typescript);
hljs.registerLanguage('javascript', javascript);
hljs.registerLanguage('bash', bash);
hljs.registerLanguage('json', json);
hljs.registerLanguage('xml', xml);
hljs.registerLanguage('sql', sql);
hljs.registerLanguage('yaml', yaml);
hljs.registerLanguage('dockerfile', dockerfile);
hljs.registerLanguage('http', http);
hljs.registerAliases(['ts', 'tsx'], { languageName: 'typescript' });
hljs.registerAliases(['js', 'jsx'], { languageName: 'javascript' });
hljs.registerAliases(['html'], { languageName: 'xml' });
hljs.registerAliases(['sh', 'shell'], { languageName: 'bash' });

function enhance(root: HTMLElement | null): void {
  if (!root) {
    return;
  }
  root.querySelectorAll<HTMLElement>('pre code').forEach((element) => {
    const language = /language-(\S+)/.exec(element.className)?.[1];
    if (language && hljs.getLanguage(language) && !element.dataset.highlighted) {
      hljs.highlightElement(element);
    }
  });
  root.querySelectorAll<HTMLAnchorElement>('a[href^="http"]').forEach((link) => {
    link.target = '_blank';
    link.rel = 'noreferrer';
  });
}

/** Le contenu provient uniquement des fichiers Markdown du dépôt : il est considéré comme fiable. */
export function Markdown({ text, className = '' }: { text: string; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const html = useMemo(() => marked.parse(text, { async: false }), [text]);

  useEffect(() => enhance(ref.current), [html]);

  return <div ref={ref} className={`md ${className}`} dangerouslySetInnerHTML={{ __html: html }} />;
}

export function InlineMarkdown({ text }: { text: string }) {
  const html = useMemo(() => marked.parseInline(text, { async: false }), [text]);

  return <span className="md-inline" dangerouslySetInnerHTML={{ __html: html }} />;
}
