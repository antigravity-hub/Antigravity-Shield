#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
fix_bubble_and_justify_master.py
Master refinement for Antigravity IDE & Platform:
1. Fix user message bubble docking & border wrapper:
   - Inner [data-testid="user-message-bubble"] fills 100% of wrapper without margin offset.
   - Outer .relative.p-px.rounded-xl.bg-card-border:has([data-testid="user-message-bubble"])
     is the single unit with width: fit-content, max-width: 85%, and margin-left: auto for RTL.
   - Outer row container flex-aligns to flex-end for RTL, flex-start for LTR.
   - Zero exposed green container on left; flush 0px docking against right wall for RTL.
2. Fix Full Align (Strict Justify):
   - Replace any lingering text-align: right on paragraphs and lists with text-align: justify.
3. Keep Composer Toolbar shielded (Model selector left, send button right).
4. Synchronize all targets (vazirmatn_clean.css, patch.rs, rtl-proxy.js, vazirmatn.css, platform_rtl_daemon.pyw).
"""

import os
import re

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CSS_FILE = os.path.join(ROOT_DIR, "scripts", "vazirmatn_clean.css")
PATCH_RS = os.path.join(ROOT_DIR, "src-tauri", "src", "commands", "patch.rs")
IDE_EXT_DIR = r"C:\Users\ersha\AppData\Local\Programs\Antigravity IDE\resources\app\extensions\agy\vscode"
IDE_CSS = os.path.join(IDE_EXT_DIR, "vazirmatn.css")
IDE_JS = os.path.join(IDE_EXT_DIR, "rtl-proxy.js")
PLATFORM_PYW = r"C:\Users\ersha\.gemini\antigravity\platform_rtl_daemon.pyw"

def fix_css_content(css: str) -> str:
    # 1. Ensure list items have full justification
    css = re.sub(
        r'(/\* Layer 1 List Item \*/\s*.*?text-align:)\s*right\s*!important;',
        r'\1 justify !important;\n  text-justify: inter-word !important;',
        css,
        flags=re.DOTALL
    )
    css = re.sub(
        r'(/\* =+\s*Numbered lists \(OL\).*?text-align:)\s*right\s*!important;\s*(text-align-last:\s*start\s*!important;)',
        r'\1 justify !important;\n  text-justify: inter-word !important;\n  \2',
        css,
        flags=re.DOTALL
    )
    css = re.sub(
        r'(/\* Persian Paragraphs & Lists: Force Direction RTL, Right-Align Last Line \*/\s*.*?)text-align:\s*right\s*!important;',
        r'\1text-align: justify !important;\n  text-justify: inter-word !important;',
        css,
        flags=re.DOTALL
    )

    # 1.5 Fix Blockquotes & GitHub Alerts: eliminate double-container glitch and Chromium backdrop seam
    alert_pattern = re.compile(
        r'/\* =+\s*4\. Blockquotes & GitHub Alerts.*?(?=/\* =+\s*5\. Inputs & Textareas)',
        re.DOTALL
    )
    new_alerts = """/* ==========================================================================
   4. Blockquotes & GitHub Alerts (TIP, NOTE, IMPORTANT, WARNING, CAUTION)
   ========================================================================== */

/* Immunity against nested wrapper artifacts (Eliminate double-border glitch line) */
blockquote:has(.markdown-alert),
.rendered-markdown blockquote:has(.markdown-alert),
[role="article"] blockquote:has(.markdown-alert),
.chat-widget .rendered-markdown blockquote:has(.markdown-alert),
blockquote:has(> .markdown-alert),
.markdown-alert blockquote {
  border: none !important;
  padding: 0 !important;
  margin: 0 !important;
  background: transparent !important;
  backdrop-filter: none !important;
  box-shadow: none !important;
  border-radius: 0 !important;
}

/* Standalone Clean Blockquotes */
.rendered-markdown blockquote:not(:has(.markdown-alert)),
[role="article"] blockquote:not(:has(.markdown-alert)),
.chat-widget .rendered-markdown blockquote:not(:has(.markdown-alert)),
.antigravity-agent-side-panel blockquote:not(:has(.markdown-alert)),
.antigravity-agent-manager blockquote:not(:has(.markdown-alert)),
.animate-markdown blockquote:not(:has(.markdown-alert)) {
  border: none !important;
  border-inline-start: 4px solid #93e9be !important;
  border-radius: 8px !important;
  padding: 12px 16px !important;
  margin: 16px 0 !important;
  background: rgba(147, 233, 190, 0.08) !important;
  unicode-bidi: plaintext !important;
  text-align: justify !important;
  text-justify: inter-word !important;
  text-align-last: start !important;
}

/* Clean Single-Container Markdown Alerts */
.markdown-alert,
[role="article"] .markdown-alert,
.rendered-markdown .markdown-alert,
.chat-widget .rendered-markdown .markdown-alert,
.antigravity-agent-side-panel .markdown-alert,
.antigravity-agent-manager .markdown-alert,
.animate-markdown .markdown-alert {
  border: 1px solid rgba(147, 233, 190, 0.22) !important;
  border-inline-start: 4px solid #93e9be !important;
  border-radius: 8px !important;
  padding: 12px 16px !important;
  margin: 16px 0 !important;
  box-sizing: border-box !important;
  unicode-bidi: plaintext !important;
  text-align: justify !important;
  text-justify: inter-word !important;
  text-align-last: start !important;
}

.markdown-alert.markdown-alert-tip,
[role="article"] .markdown-alert.markdown-alert-tip,
.rendered-markdown .markdown-alert.markdown-alert-tip {
  border-inline-start-color: #93e9be !important;
  border-color: rgba(147, 233, 190, 0.28) !important;
  background: linear-gradient(135deg, rgba(147, 233, 190, 0.12) 0%, rgba(147, 233, 190, 0.04) 100%) !important;
}

.markdown-alert.markdown-alert-tip .markdown-alert-title,
[role="article"] .markdown-alert.markdown-alert-tip .markdown-alert-title,
.rendered-markdown .markdown-alert.markdown-alert-tip .markdown-alert-title {
  color: #93e9be !important;
  font-weight: 700 !important;
  margin-bottom: 6px !important;
  display: flex !important;
  align-items: center !important;
  gap: 6px !important;
}

.markdown-alert.markdown-alert-note,
[role="article"] .markdown-alert.markdown-alert-note,
.rendered-markdown .markdown-alert.markdown-alert-note {
  border-inline-start-color: #38bdf8 !important;
  border-color: rgba(56, 189, 248, 0.28) !important;
  background: linear-gradient(135deg, rgba(56, 189, 248, 0.12) 0%, rgba(56, 189, 248, 0.04) 100%) !important;
}

.markdown-alert.markdown-alert-note .markdown-alert-title,
[role="article"] .markdown-alert.markdown-alert-note .markdown-alert-title,
.rendered-markdown .markdown-alert.markdown-alert-note .markdown-alert-title {
  color: #38bdf8 !important;
  font-weight: 700 !important;
  margin-bottom: 6px !important;
}

.markdown-alert.markdown-alert-important,
[role="article"] .markdown-alert.markdown-alert-important,
.rendered-markdown .markdown-alert.markdown-alert-important {
  border-inline-start-color: #a78bfa !important;
  border-color: rgba(167, 139, 250, 0.28) !important;
  background: linear-gradient(135deg, rgba(167, 139, 250, 0.12) 0%, rgba(167, 139, 250, 0.04) 100%) !important;
}

.markdown-alert.markdown-alert-important .markdown-alert-title,
[role="article"] .markdown-alert.markdown-alert-important .markdown-alert-title,
.rendered-markdown .markdown-alert.markdown-alert-important .markdown-alert-title {
  color: #c4b5fd !important;
  font-weight: 700 !important;
  margin-bottom: 6px !important;
}

.markdown-alert.markdown-alert-warning,
[role="article"] .markdown-alert.markdown-alert-warning,
.rendered-markdown .markdown-alert.markdown-alert-warning {
  border-inline-start-color: #f59e0b !important;
  border-color: rgba(245, 158, 11, 0.28) !important;
  background: linear-gradient(135deg, rgba(245, 158, 11, 0.12) 0%, rgba(245, 158, 11, 0.04) 100%) !important;
}

.markdown-alert.markdown-alert-warning .markdown-alert-title,
[role="article"] .markdown-alert.markdown-alert-warning .markdown-alert-title,
.rendered-markdown .markdown-alert.markdown-alert-warning .markdown-alert-title {
  color: #fbbf24 !important;
  font-weight: 700 !important;
  margin-bottom: 6px !important;
}

.markdown-alert.markdown-alert-caution,
[role="article"] .markdown-alert.markdown-alert-caution,
.rendered-markdown .markdown-alert.markdown-alert-caution {
  border-inline-start-color: #ef4444 !important;
  border-color: rgba(239, 68, 68, 0.28) !important;
  background: linear-gradient(135deg, rgba(239, 68, 68, 0.12) 0%, rgba(239, 68, 68, 0.04) 100%) !important;
}

.markdown-alert.markdown-alert-caution .markdown-alert-title,
[role="article"] .markdown-alert.markdown-alert-caution .markdown-alert-title,
.rendered-markdown .markdown-alert.markdown-alert-caution .markdown-alert-title {
  color: #f87171 !important;
  font-weight: 700 !important;
  margin-bottom: 6px !important;
}

"""
    if alert_pattern.search(css):
        css = alert_pattern.sub(new_alerts, css)


    # 2. Refine the User Message Bubble & Outer Card Wrapper Section
    # Find the section at the bottom
    docking_pattern = re.compile(
        r'/\* =+\s*User Prompt Bubble: Dynamic Floating Geometry & Docking.*?(?=/\* =+\s*Chat Composer)',
        re.DOTALL
    )

    new_docking = """/* ==========================================================================
   User Prompt Bubble: Dynamic Floating Geometry & Docking
   ========================================================================== */

/* 1. Eliminate Outer Wrapper Green Ghost Artifact: Wrapper must be 100% transparent */
.relative.p-px.rounded-xl.bg-card-border:has([data-testid="user-message-bubble"]),
div:has(> [data-testid="user-message-bubble"]) {
  background: transparent !important;
  background-color: transparent !important;
  border: none !important;
  padding: 0 !important;
  box-shadow: none !important;
  width: fit-content !important;
  max-width: 85% !important;
}

/* 2. Self-Contained User Message Bubble with Natural Horizontal Expansion (No word collapse!) */
[data-testid="user-message-bubble"],
[data-testid="user-input-step"] > div:has([data-testid="user-message-bubble"]) {
  background-color: #0f1c24 !important;
  border: 1px solid rgba(16, 185, 129, 0.35) !important;
  border-radius: 12px !important;
  box-shadow: 0 0 14px -2px rgba(16, 185, 129, 0.18) !important;
  color: #f1f5f9 !important;
  width: fit-content !important;
  max-width: 85% !important;
  display: flex !important;
  box-sizing: border-box !important;
  padding: 8px 14px !important;
}

/* Stop Flex-1 Collapse: Allow text to expand horizontally to its full line width! */
[data-testid="user-message-bubble"] > div:first-child,
[data-testid="user-message-bubble"] .flex-1,
[data-testid="user-message-bubble"] [class*="flex-1"] {
  flex: 0 1 auto !important;
  min-width: fit-content !important;
  width: auto !important;
  white-space: pre-wrap !important;
  word-break: break-word !important;
  overflow-wrap: break-word !important;
  line-height: 1.8 !important;
}

/* RTL: Outer Card & Row Docks Flush to the RIGHT with 0 margin-right */
.relative.p-px.rounded-xl.bg-card-border:has([data-testid="user-message-bubble"]:dir(rtl)),
.relative.p-px.rounded-xl.bg-card-border:has([data-testid="user-message-bubble"][dir="rtl"]),
.relative.p-px.rounded-xl.bg-card-border:has([dir="rtl"]),
div:has(> [data-testid="user-message-bubble"]:dir(rtl)),
div:has(> [data-testid="user-message-bubble"][dir="rtl"]),
div:has(> [dir="rtl"] > [data-testid="user-message-bubble"]),
[data-testid="user-message-bubble"]:dir(rtl),
[data-testid="user-message-bubble"][dir="rtl"],
[data-testid="user-input-step"]:dir(rtl),
[data-testid="user-input-step"][dir="rtl"],
[aria-label="User message"]:dir(rtl),
[aria-label="User message"][dir="rtl"],
.agy-user-bubble:dir(rtl),
.agy-user-bubble[dir="rtl"],
.agy-user-bubble-frame:dir(rtl),
.agy-user-bubble-frame[dir="rtl"] {
  margin-left: auto !important;
  margin-right: 0px !important;
  align-self: flex-end !important;
  direction: rtl !important;
}

/* LTR: Outer Card & Row Docks Flush to the LEFT */
.relative.p-px.rounded-xl.bg-card-border:has([data-testid="user-message-bubble"]:dir(ltr)),
.relative.p-px.rounded-xl.bg-card-border:has([data-testid="user-message-bubble"][dir="ltr"]),
.relative.p-px.rounded-xl.bg-card-border:has([dir="ltr"]),
div:has(> [data-testid="user-message-bubble"]:dir(ltr)),
div:has(> [data-testid="user-message-bubble"][dir="ltr"]),
div:has(> [dir="ltr"] > [data-testid="user-message-bubble"]),
[data-testid="user-message-bubble"]:dir(ltr),
[data-testid="user-message-bubble"][dir="ltr"],
[data-testid="user-input-step"]:dir(ltr),
[data-testid="user-input-step"][dir="ltr"],
[aria-label="User message"]:dir(ltr),
[aria-label="User message"][dir="ltr"],
.agy-user-bubble:dir(ltr),
.agy-user-bubble[dir="ltr"],
.agy-user-bubble-frame:dir(ltr),
.agy-user-bubble-frame[dir="ltr"] {
  margin-left: 0px !important;
  margin-right: auto !important;
  align-self: flex-start !important;
  direction: ltr !important;
}

/* Outer Row Container (div.w-full & user-input-step) flex-aligns to the edge */
div:has(> .relative.p-px.rounded-xl.bg-card-border > [data-testid="user-message-bubble"]:dir(rtl)),
div:has(> .relative.p-px.rounded-xl.bg-card-border > [data-testid="user-message-bubble"][dir="rtl"]),
div.w-full:has([data-testid="user-message-bubble"]:dir(rtl)),
div.w-full:has([data-testid="user-message-bubble"][dir="rtl"]),
[data-testid="user-input-step"]:has([data-testid="user-message-bubble"]:dir(rtl)),
[data-testid="user-input-step"]:has([data-testid="user-message-bubble"][dir="rtl"]) {
  display: flex !important;
  flex-direction: column !important;
  align-items: flex-end !important;
  justify-content: flex-end !important;
  width: 100% !important;
}

div:has(> .relative.p-px.rounded-xl.bg-card-border > [data-testid="user-message-bubble"]:dir(ltr)),
div:has(> .relative.p-px.rounded-xl.bg-card-border > [data-testid="user-message-bubble"][dir="ltr"]),
div.w-full:has([data-testid="user-message-bubble"]:dir(ltr)),
div.w-full:has([data-testid="user-message-bubble"][dir="ltr"]),
[data-testid="user-input-step"]:has([data-testid="user-message-bubble"]:dir(ltr)),
[data-testid="user-input-step"]:has([data-testid="user-message-bubble"][dir="ltr"]) {
  display: flex !important;
  flex-direction: column !important;
  align-items: flex-start !important;
  justify-content: flex-start !important;
  width: 100% !important;
}

"""

    if docking_pattern.search(css):
        css = docking_pattern.sub(new_docking, css)
    else:
        css = css + "\n" + new_docking

    return css

def generate_rtl_proxy_js(full_css: str) -> str:
    return r"""// Antigravity Shield - Local RTL Proxy for Antigravity IDE Chat Panel
'use strict';
const http = require('http');
const net = require('net');
const fs = require('fs');
const path = require('path');

const FONT_PATH = path.join(__dirname, 'Vazirmatn-Variable.woff2');
let fontBuffer = null;
if (fs.existsSync(FONT_PATH)) {
  try {
    fontBuffer = fs.readFileSync(FONT_PATH);
  } catch (e) {}
}

const CSS_PATH = path.join(__dirname, 'vazirmatn.css');
let fullCss = '';
if (fs.existsSync(CSS_PATH)) {
  try {
    fullCss = fs.readFileSync(CSS_PATH, 'utf-8');
  } catch (e) {}
}

const SCRIPT_INJECT = `
<script>
(function () {
  var isPersian = function (s) { return /[\u0600-\u06FF]/.test(s); };
  var EDITABLE = 'textarea,input,[contenteditable]:not([contenteditable="false"])';
  // Note: EXCLUDE .relative.p-px.rounded-xl.bg-card-border from USER_BUBBLE_SEL so composer never inverts!
  var USER_BUBBLE_SEL = '[data-testid="user-message-bubble"],[aria-label="User message"],.agy-user-bubble,[data-testid="user-input-step"]:not(:has(textarea))';
  var SEL = 'p,li,h1,h2,h3,h4,h5,h6,blockquote,td,th,.whitespace-pre-wrap,.leading-relaxed,[role="article"],[data-testid="conversation-view"],' + USER_BUBBLE_SEL + ',' + EDITABLE;

  function applyBiDi(el) {
    if (!el || el.nodeType !== 1) return;
    if (el.tagName === 'CODE' || el.tagName === 'PRE' || el.closest('pre') || el.closest('code') || el.closest('.monaco-editor')) return;
    if (el.classList && (el.classList.contains('codicon') || el.classList.contains('google-symbols'))) return;

    // Strict Composer Isolation: NEVER touch composer container or toolbars
    var isComposer = el.closest('form, div:has(> textarea), div:has(> [data-lexical-editor="true"])');
    if (isComposer && el.tagName !== 'TEXTAREA' && !el.isContentEditable && el.getAttribute('role') !== 'textbox') {
      return;
    }

    var txt = (el.textContent || '').trim();
    var persian = isPersian(txt);

    // 1. Textarea / Editable input: ONLY change direction of text itself, NEVER invert layout
    if (el.tagName === 'TEXTAREA' || el.isContentEditable || el.getAttribute('role') === 'textbox') {
      if (persian) {
        el.setAttribute('dir', 'rtl');
        el.style.setProperty('direction', 'rtl', 'important');
        el.style.setProperty('text-align', 'right', 'important');
      } else if (txt.length > 0) {
        el.setAttribute('dir', 'ltr');
        el.style.setProperty('direction', 'ltr', 'important');
        el.style.setProperty('text-align', 'left', 'important');
      }
      return;
    }

    // 2. User Message Bubble Docking (RTL attaches to the RIGHT, LTR to the LEFT)
    // Only applies to past message turns, NEVER to composer
    if (el.matches && el.matches(USER_BUBBLE_SEL)) {
      if (el.querySelector('textarea, form, [data-lexical-editor="true"]')) return;

      var cardWrapper = el.closest('.relative.p-px.rounded-xl.bg-card-border') || el.parentElement;
      var rowContainer = cardWrapper ? cardWrapper.parentElement : null;

      if (cardWrapper && cardWrapper !== document.body) {
        cardWrapper.style.setProperty('background', 'transparent', 'important');
        cardWrapper.style.setProperty('background-color', 'transparent', 'important');
        cardWrapper.style.setProperty('border', 'none', 'important');
        cardWrapper.style.setProperty('padding', '0px', 'important');
        cardWrapper.style.setProperty('box-shadow', 'none', 'important');
        cardWrapper.style.setProperty('width', 'fit-content', 'important');
        cardWrapper.style.setProperty('max-width', '85%', 'important');
      }

      // Bubble card itself with natural horizontal expansion
      el.style.setProperty('background-color', '#0f1c24', 'important');
      el.style.setProperty('border', '1px solid rgba(16, 185, 129, 0.35)', 'important');
      el.style.setProperty('border-radius', '12px', 'important');
      el.style.setProperty('box-shadow', '0 0 14px -2px rgba(16, 185, 129, 0.18)', 'important');
      el.style.setProperty('width', 'fit-content', 'important');
      el.style.setProperty('max-width', '85%', 'important');
      el.style.setProperty('display', 'flex', 'important');
      el.style.setProperty('box-sizing', 'border-box', 'important');
      el.style.setProperty('padding', '8px 14px', 'important');

      // Stop Flex-1 Collapse: Allow text to expand horizontally to its full line width!
      var textChild = el.querySelector('.flex-1') || el.firstElementChild;
      if (textChild) {
        textChild.style.setProperty('flex', '0 1 auto', 'important');
        textChild.style.setProperty('min-width', 'fit-content', 'important');
        textChild.style.setProperty('width', 'auto', 'important');
        textChild.style.setProperty('white-space', 'pre-wrap', 'important');
        textChild.style.setProperty('line-height', '1.8', 'important');
      }

      if (persian) {
        el.setAttribute('dir', 'rtl');
        el.style.setProperty('direction', 'rtl', 'important');
        el.style.setProperty('margin-left', 'auto', 'important');
        el.style.setProperty('margin-right', '0px', 'important');
        el.style.setProperty('align-self', 'flex-end', 'important');
        if (cardWrapper && cardWrapper !== document.body) {
          cardWrapper.setAttribute('dir', 'rtl');
          cardWrapper.style.setProperty('margin-left', 'auto', 'important');
          cardWrapper.style.setProperty('margin-right', '0px', 'important');
          cardWrapper.style.setProperty('align-self', 'flex-end', 'important');
        }
      } else if (txt.length > 0) {
        el.setAttribute('dir', 'ltr');
        el.style.setProperty('direction', 'ltr', 'important');
        el.style.setProperty('margin-right', 'auto', 'important');
        el.style.setProperty('margin-left', '0px', 'important');
        el.style.setProperty('align-self', 'flex-start', 'important');
        if (cardWrapper && cardWrapper !== document.body) {
          cardWrapper.setAttribute('dir', 'ltr');
          cardWrapper.style.setProperty('margin-right', 'auto', 'important');
          cardWrapper.style.setProperty('margin-left', '0px', 'important');
          cardWrapper.style.setProperty('align-self', 'flex-start', 'important');
        }
      }

      if (rowContainer && rowContainer !== document.body) {
        rowContainer.style.setProperty('display', 'flex', 'important');
        rowContainer.style.setProperty('flex-direction', 'column', 'important');
        rowContainer.style.setProperty('width', '100%', 'important');
        if (persian) {
          rowContainer.style.setProperty('align-items', 'flex-end', 'important');
          rowContainer.style.setProperty('justify-content', 'flex-end', 'important');
        } else if (txt.length > 0) {
          rowContainer.style.setProperty('align-items', 'flex-start', 'important');
          rowContainer.style.setProperty('justify-content', 'flex-start', 'important');
        }
      }
      return;
    }

    // 3. Persian Content Formatting (Full Align Justify on Paragraphs and Lists)
    if (persian) {
      if (el.getAttribute('dir') !== 'rtl') el.setAttribute('dir', 'rtl');
      if (el.style.direction !== 'rtl') el.style.setProperty('direction', 'rtl', 'important');

      // Full Align (Justify) for both P and LI
      if (el.tagName === 'P' || el.tagName === 'LI') {
        el.style.setProperty('text-align', 'justify', 'important');
        el.style.setProperty('text-justify', 'inter-word', 'important');
        el.style.setProperty('text-align-last', 'start', 'important');
        el.style.setProperty('line-height', '2.1', 'important');
      }

      if (el.tagName === 'LI') {
        el.style.setProperty('padding-left', '0', 'important');
        el.style.setProperty('margin-left', '0', 'important');
        
        // Guard: NEVER treat outer conversation turn items as markdown bullet lists
        var mdContainer = el.closest('.rendered-markdown, .prose, .markdown-body');
        if (!mdContainer) return;

        var parentList = el.closest('ul, ol');
        if (parentList) {
          if (parentList.getAttribute('dir') !== 'rtl') parentList.setAttribute('dir', 'rtl');
          parentList.style.setProperty('direction', 'rtl', 'important');
          parentList.style.setProperty('padding-left', '0', 'important');
          parentList.style.setProperty('margin-left', '0', 'important');
          if (parentList.tagName === 'UL') {
            parentList.style.setProperty('padding-right', '28px', 'important');
            parentList.style.setProperty('list-style', 'none', 'important');
          } else if (parentList.tagName === 'OL') {
            parentList.style.setProperty('padding-right', '32px', 'important');
          }
        }
      } else if (/^H[1-6]$/.test(el.tagName)) {
        el.style.setProperty('padding-left', '0', 'important');
        el.style.setProperty('padding-right', '0', 'important');
        el.style.setProperty('margin-left', '0', 'important');
        el.style.setProperty('color', '#93e9be', 'important');
        el.style.setProperty('border-bottom', '1px solid rgba(147, 233, 190, 0.3)', 'important');
        el.style.setProperty('padding-bottom', '0.4rem', 'important');
      } else if (el.tagName === 'BLOCKQUOTE') {
        if (el.querySelector('.markdown-alert') || el.closest('.markdown-alert')) {
          el.style.setProperty('border', 'none', 'important');
          el.style.setProperty('padding', '0px', 'important');
          el.style.setProperty('margin', '0px', 'important');
          el.style.setProperty('background', 'transparent', 'important');
          return;
        }
        el.style.setProperty('border-left', 'none', 'important');
        el.style.setProperty('border-right', '4px solid #93e9be', 'important');
      }
    }
  }

  function fix(root) {
    if (!root || !root.querySelectorAll) return;
    if (root.matches && root.matches(SEL)) applyBiDi(root);
    var targets = root.querySelectorAll(SEL);
    for (var i = 0; i < targets.length; i++) {
      applyBiDi(targets[i]);
    }
  }

  function start() {
    fix(document.body);
    var obs = new MutationObserver(function (mutations) {
      for (var i = 0; i < mutations.length; i++) {
        var m = mutations[i];
        for (var j = 0; j < m.addedNodes.length; j++) {
          var n = m.addedNodes[j];
          if (n.nodeType === 1) fix(n);
        }
      }
    });
    obs.observe(document.body, { childList: true, subtree: true });
  }

  if (document.body) start();
  else document.addEventListener('DOMContentLoaded', start);
})();
</script>
`;

function getInjectHtml() {
  return '<style id="antigravity-shield-chat-rtl">\n' + fullCss + '\n</style>\n' + SCRIPT_INJECT;
}

let target = null;
let server = null;
let port = 0;

function rewriteHeaders(h) {
  const out = Object.assign({}, h);
  out.host = target.host + ':' + target.port;
  if (out.origin) out.origin = target.origin;
  if (out.referer) out.referer = out.referer.replace(/^https?:\/\/[^/]+/, target.origin);
  return out;
}

function ensureServer() {
  if (server) return;
  server = http.createServer((req, res) => {
    if (req.url === '/__agy_rtl/vazirmatn.woff2') {
      if (fontBuffer) {
        res.writeHead(200, {
          'Content-Type': 'font/woff2',
          'Content-Length': fontBuffer.length,
          'Cache-Control': 'public, max-age=31536000'
        });
        return res.end(fontBuffer);
      } else {
        res.writeHead(404);
        return res.end();
      }
    }
    if (!target) {
      res.writeHead(502);
      return res.end();
    }
    const headers = rewriteHeaders(req.headers);
    headers['accept-encoding'] = 'identity';
    const up = http.request(
      { host: target.host, port: target.port, method: req.method, path: req.url, headers },
      (ur) => {
        const h = Object.assign({}, ur.headers);
        const isHtml = /text\/html/.test(h['content-type'] || '');
        if (!isHtml) {
          res.writeHead(ur.statusCode, h);
          return ur.pipe(res);
        }
        const chunks = [];
        ur.on('data', (c) => chunks.push(c));
        ur.on('end', () => {
          let body = Buffer.concat(chunks).toString('utf8');
          const inject = getInjectHtml();
          body = body.includes('</head>') ? body.replace('</head>', inject + '</head>') : inject + body;
          delete h['content-length'];
          delete h['content-encoding'];
          res.writeHead(ur.statusCode, h);
          res.end(body);
        });
      }
    );
    up.on('error', () => {
      try { res.writeHead(502); res.end(); } catch (e) {}
    });
    req.pipe(up);
  });

  server.on('upgrade', (req, sock, head) => {
    if (!target) return sock.destroy();
    const up = net.connect(target.port, target.host, () => {
      const h = rewriteHeaders(req.headers);
      let raw = `${req.method} ${req.url} HTTP/1.1\r\n`;
      for (const k in h) raw += `${k}: ${h[k]}\r\n`;
      up.write(raw + '\r\n');
      if (head && head.length) up.write(head);
      up.pipe(sock);
      sock.pipe(up);
    });
    up.on('error', () => {
      try { sock.destroy(); } catch (e) {}
    });
  });

  server.listen(0, '127.0.0.1', () => {
    port = server.address().port;
  });
}

function getProxyUrl(originalUrl) {
  try {
    const u = new URL(originalUrl);
    target = {
      protocol: u.protocol,
      host: u.hostname,
      port: u.port || (u.protocol === 'https:' ? 443 : 80),
      origin: u.origin
    };
    ensureServer();
    return originalUrl.replace(`${target.host}:${target.port}`, `127.0.0.1:${port}`);
  } catch (e) {
    return originalUrl;
  }
}

module.exports = { getProxyUrl };
"""

def update_patch_rs(full_css: str, proxy_js: str):
    with open(PATCH_RS, "r", encoding="utf-8") as f:
        content = f.read()

    pattern = re.compile(r'pub const VAZIRMATN_RTL_CSS: &str = r#".*?"#;', re.DOTALL)
    if pattern.search(content):
        content = pattern.sub(f'pub const VAZIRMATN_RTL_CSS: &str = r#"\n{full_css}\n"#;', content)
    else:
        css_escaped = full_css.replace("\\", "\\\\").replace('"', '\\"')
        content = re.sub(
            r'pub const VAZIRMATN_RTL_CSS: &str = ".*?";',
            f'pub const VAZIRMATN_RTL_CSS: &str = "{css_escaped}";',
            content,
            flags=re.DOTALL
        )

    with open(PATCH_RS, "w", encoding="utf-8") as f:
        f.write(content)
    print("Updated src-tauri/src/commands/patch.rs")

def main():
    print("Reading and refining vazirmatn_clean.css...")
    with open(CSS_FILE, "r", encoding="utf-8") as f:
        raw_css = f.read()

    refined_css = fix_css_content(raw_css)
    with open(CSS_FILE, "w", encoding="utf-8") as f:
        f.write(refined_css)
    print("Refined vazirmatn_clean.css written.")

    # Generate rtl-proxy.js
    proxy_js = generate_rtl_proxy_js(refined_css)

    # Write to IDE directory
    os.makedirs(IDE_EXT_DIR, exist_ok=True)
    with open(IDE_CSS, "w", encoding="utf-8") as f:
        f.write(refined_css)
    print(f"Written to {IDE_CSS}")

    with open(IDE_JS, "w", encoding="utf-8") as f:
        f.write(proxy_js)
    print(f"Written to {IDE_JS}")

    # Update patch.rs
    update_patch_rs(refined_css, proxy_js)

    print("\n[SUCCESS] Master refinement applied across CSS, JS, and Rust!")

if __name__ == "__main__":
    main()

