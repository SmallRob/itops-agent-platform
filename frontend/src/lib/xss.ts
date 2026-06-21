import DOMPurify from 'dompurify';
import type { Config } from 'dompurify';

/**
 * 清理文本内容，防止 XSS 攻击
 * 对于纯文本，移除所有 HTML 标签
 * @param text - 需要清理的文本
 * @returns 清理后的纯文本
 */
export function sanitizeText(text: string | null | undefined): string {
  if (!text) return '';
  return DOMPurify.sanitize(text, { ALLOWED_TAGS: [] }).trim();
}

/**
 * 清理 HTML 内容，保留安全的标签和属性
 * @param html - 需要清理的 HTML 内容
 * @param options - DOMPurify 配置选项
 * @returns 清理后的 HTML
 */
export function sanitizeHTML(
  html: string,
  options?: Config
): string {
  if (!html) return '';
  const result = DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [
      'p', 'br', 'strong', 'em', 'u', 's', 'code', 'pre',
      'blockquote', 'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'a', 'img', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'hr',
      'span', 'div', 'sup', 'sub', 'del', 'mark', 'abbr'
    ],
    ALLOWED_ATTR: [
      'href', 'src', 'alt', 'title', 'target', 'rel',
      'class', 'id', 'type', 'start', 'reversed', 'align',
      'colspan', 'rowspan', 'width', 'height'
    ],
    ALLOWED_URI_REGEXP: /^(?:(?:(?:f|ht)tps?|mailto|tel|callto|cid|xmpp):|[^a-z]|[a-z+.-]+(?:[^a-z+.-:]|$))/i,
    ...options
  });
  return String(result);
}
