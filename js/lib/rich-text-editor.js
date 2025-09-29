/**
 * Rich Text Editor Module - Provides rich text editing functionality for web application
 * Adapted from extension editor.js with XSS safety
 */
class RichTextEditor {
    constructor(contentElement, toolbarElement) {
        this.contentElement = contentElement;
        this.toolbarElement = toolbarElement;
        this.currentColor = '#000000';
        this.init();
    }

    init() {
        if (!this.contentElement || !this.toolbarElement) {
            console.error('RichTextEditor: Required elements not found');
            return;
        }

        this.setupToolbarEvents();
        this.setupContentEvents();
        this.setupKeyboardShortcuts();
    }

    setupToolbarEvents() {
        // Bold button
        const boldBtn = this.toolbarElement.querySelector('#boldBtn');
        if (boldBtn) {
            boldBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.toggleFormat('bold');
            });
        }

        // Italic button
        const italicBtn = this.toolbarElement.querySelector('#italicBtn');
        if (italicBtn) {
            italicBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.toggleFormat('italic');
            });
        }

        // Underline button
        const underlineBtn = this.toolbarElement.querySelector('#underlineBtn');
        if (underlineBtn) {
            underlineBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.toggleFormat('underline');
            });
        }

        // Strikethrough button
        const strikethroughBtn = this.toolbarElement.querySelector('#strikethroughBtn');
        if (strikethroughBtn) {
            strikethroughBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.toggleFormat('strikethrough');
            });
        }

        // Citation button
        const citationBtn = this.toolbarElement.querySelector('#citationBtn');
        if (citationBtn) {
            citationBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.toggleFormat('citation');
            });
        }

        // List button
        const listBtn = this.toolbarElement.querySelector('#listBtn');
        if (listBtn) {
            listBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.createList();
            });
        }

        // Color button and palette
        const colorBtn = this.toolbarElement.querySelector('#colorBtn');
        const colorPalette = this.toolbarElement.querySelector('#colorPalette');

        if (colorBtn && colorPalette) {
            colorBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                colorPalette.classList.toggle('hidden');
            });

            // Color options
            const colorOptions = colorPalette.querySelectorAll('.color-option');
            colorOptions.forEach(option => {
                option.addEventListener('click', (e) => {
                    e.preventDefault();
                    const color = option.dataset.color;
                    this.applyColor(color);
                    colorPalette.classList.add('hidden');
                });
            });

            // Close color palette when clicking outside
            document.addEventListener('click', (e) => {
                if (!colorBtn.contains(e.target) && !colorPalette.contains(e.target)) {
                    colorPalette.classList.add('hidden');
                }
            });
        }
    }

    setupContentEvents() {
        // Handle paste events with sanitization
        this.contentElement.addEventListener('paste', (e) => {
            this.handleEditorPaste(e);
        });

        // Handle link clicks
        this.contentElement.addEventListener('click', (e) => {
            this.handleEditorLinkClick(e);
        });

        // Handle Enter key for list continuation
        this.contentElement.addEventListener('keydown', (e) => {
            this.handleEditorKeyDown(e);
        });

        // Update toolbar state on selection change
        this.contentElement.addEventListener('mouseup', () => {
            this.updateToolbarState();
        });

        this.contentElement.addEventListener('keyup', () => {
            this.updateToolbarState();
        });
    }

    setupKeyboardShortcuts() {
        this.contentElement.addEventListener('keydown', (e) => {
            if (e.ctrlKey || e.metaKey) {
                switch (e.key.toLowerCase()) {
                    case 'b':
                        e.preventDefault();
                        this.toggleFormat('bold');
                        break;
                    case 'i':
                        e.preventDefault();
                        this.toggleFormat('italic');
                        break;
                    case 'u':
                        e.preventDefault();
                        this.toggleFormat('underline');
                        break;
                }
            }
        });
    }

    toggleFormat(format) {
        // Focus the content element
        this.contentElement.focus();

        try {
            // Use document.execCommand for consistent behavior with extension
            switch (format) {
                case 'bold':
                    document.execCommand('bold', false, null);
                    break;
                case 'italic':
                    document.execCommand('italic', false, null);
                    break;
                case 'underline':
                    document.execCommand('underline', false, null);
                    break;
                case 'strikethrough':
                    document.execCommand('strikeThrough', false, null);
                    break;
                case 'citation':
                    // Citation is custom, so use text wrapping
                    this.wrapSelection('{citation}', '{/citation}');
                    break;
            }
            this.updateToolbarState();
        } catch (error) {
            console.error(`Error applying ${format}:`, error);
        }
    }

    wrapSelection(startTag, endTag) {
        const selection = window.getSelection();
        if (!selection.rangeCount) return;

        const range = selection.getRangeAt(0);
        const selectedText = range.toString();

        if (selectedText) {
            // Wrap selected text
            const wrappedText = startTag + selectedText + endTag;
            range.deleteContents();

            // Create text node and insert
            const textNode = document.createTextNode(wrappedText);
            range.insertNode(textNode);

            // Move cursor after inserted text
            range.setStartAfter(textNode);
            range.collapse(true);
            selection.removeAllRanges();
            selection.addRange(range);
        } else {
            // Insert formatting markers at cursor
            const wrappedText = startTag + endTag;
            range.deleteContents();

            const textNode = document.createTextNode(wrappedText);
            range.insertNode(textNode);

            // Position cursor between markers
            range.setStart(textNode, startTag.length);
            range.setEnd(textNode, startTag.length);
            selection.removeAllRanges();
            selection.addRange(range);
        }

        this.contentElement.focus();
    }

    applyColor(color) {
        this.currentColor = color;

        // Update color indicator
        const colorIndicator = this.toolbarElement.querySelector('#colorIndicator');
        if (colorIndicator) {
            colorIndicator.style.backgroundColor = color;
        }

        const selection = window.getSelection();
        if (!selection.rangeCount) return;

        const range = selection.getRangeAt(0);
        const selectedText = range.toString();

        if (selectedText) {
            // Wrap selected text with color
            const coloredText = `{color:${color}}${selectedText}{/color}`;
            range.deleteContents();

            const textNode = document.createTextNode(coloredText);
            range.insertNode(textNode);

            // Move cursor after inserted text
            range.setStartAfter(textNode);
            range.collapse(true);
            selection.removeAllRanges();
            selection.addRange(range);
        } else {
            // Insert color markers at cursor
            const coloredText = `{color:${color}}{/color}`;
            range.deleteContents();

            const textNode = document.createTextNode(coloredText);
            range.insertNode(textNode);

            // Position cursor between markers
            const startPos = `{color:${color}}`.length;
            range.setStart(textNode, startPos);
            range.setEnd(textNode, startPos);
            selection.removeAllRanges();
            selection.addRange(range);
        }

        this.contentElement.focus();
    }

    createList() {
        const selection = window.getSelection();
        if (!selection.rangeCount) return;

        const range = selection.getRangeAt(0);

        // Always create a new line for the list button
        const brElement = document.createElement('br');
        range.insertNode(brElement);
        range.setStartAfter(brElement);

        // Insert bullet point
        const bulletText = document.createTextNode('• ');
        range.insertNode(bulletText);

        // Move cursor after bullet
        range.setStartAfter(bulletText);
        range.collapse(true);
        selection.removeAllRanges();
        selection.addRange(range);

        this.contentElement.focus();
    }

    handleEditorKeyDown(e) {
        if (e.key === 'Enter') {
            const selection = window.getSelection();
            if (!selection.rangeCount) return;

            const range = selection.getRangeAt(0);
            const currentNode = range.startContainer;

            // Check if we're on a line that contains a bullet (anywhere on the line)
            if (currentNode.nodeType === Node.TEXT_NODE) {
                const textBeforeCursor = currentNode.textContent.substring(0, range.startOffset);
                const lines = textBeforeCursor.split('\n');
                const currentLine = lines[lines.length - 1];

                // Check if the current line contains a bullet anywhere, not just at the start
                if (currentLine.includes('•')) {
                    e.preventDefault();

                    // Create new line first
                    const brElement = document.createElement('br');
                    range.insertNode(brElement);
                    range.setStartAfter(brElement);

                    // Insert bullet point on the new line
                    const bulletText = document.createTextNode('• ');
                    range.insertNode(bulletText);

                    // Move cursor after bullet
                    range.setStartAfter(bulletText);
                    range.collapse(true);
                    selection.removeAllRanges();
                    selection.addRange(range);

                    this.contentElement.focus();
                    return; // Exit early to prevent default behavior
                }
            }

            // If not in list mode, let default Enter behavior happen
        }
    }

    handleEditorPaste(e) {
        try {
            // Use clipboardData from the event, with fallback for older browsers
            const clipboard = e.clipboardData || window['clipboardData'];
            if (!clipboard) return; // let default behavior

            const text = clipboard.getData('text/plain');
            if (!text) return;

            e.preventDefault();
            const html = this.sanitizePastedTextToHtml(text);
            this.insertHtmlAtCaret(html);
        } catch (error) {
            console.error('Paste error:', error);
            // On error, allow default paste
        }
    }

    handleEditorLinkClick(e) {
        const target = e.target;
        if (target && target.tagName === 'A') {
            e.preventDefault();
            e.stopPropagation();
            const href = target.getAttribute('href');
            if (href) {
                window.open(href, '_blank', 'noopener,noreferrer');
            }
            return false;
        }
    }

    sanitizePastedTextToHtml(text) {
        const escapeHtml = (s) => (s || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&#34;')
            .replace(/'/g, '&#39;');

        // Split into lines and escape first
        const raw = (text || '').replace(/\r\n?/g, '\n');
        const lines = raw.split('\n').map(escapeHtml);

        // Linkify URLs and emails per line
        const urlRe = /\b(https?:\/\/[^\s<>"]+)\b/g;
        const emailRe = /\b([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})\b/gi;

        const linked = lines.map(line => {
            let out = line.replace(urlRe, (m) => `<a href="${m}" target="_blank" rel="noopener noreferrer">${m}</a>`);
            out = out.replace(emailRe, (m) => `<a href="mailto:${m}">${m}</a>`);
            return out;
        });

        return linked.join('<br>');
    }

    insertHtmlAtCaret(html) {
        const sel = window.getSelection();
        if (!sel || sel.rangeCount === 0) return;

        const range = sel.getRangeAt(0);
        range.deleteContents();

        // Create a temporary div to parse HTML safely
        const temp = document.createElement('div');

        // Use safe DOM manipulation if available
        if (window.safeDOM) {
            window.safeDOM.setInnerHTML(temp, html, true);
        } else {
            temp.innerHTML = html;
        }

        // Insert each child node
        const frag = document.createDocumentFragment();
        while (temp.firstChild) {
            frag.appendChild(temp.firstChild);
        }

        const lastNode = frag.lastChild;
        range.insertNode(frag);

        // Move caret after inserted content
        if (lastNode) {
            range.setStartAfter(lastNode);
            range.collapse(true);
            sel.removeAllRanges();
            sel.addRange(range);
        }
    }

    updateToolbarState() {
        // This would check the current selection and update toolbar button states
        // For now, we'll keep it simple since we're using markdown-style formatting
        const selection = window.getSelection();
        if (!selection.rangeCount) return;

        // You could implement logic here to detect if the current selection
        // is within formatted text and update button states accordingly
    }

    // Convert content to markdown for storage (similar to extension)
    htmlToMarkdown(html) {
        const tmp = document.createElement('div');

        // Use safe DOM manipulation if available
        if (window.safeDOM) {
            window.safeDOM.setInnerHTML(tmp, html || '', true);
        } else {
            tmp.innerHTML = html || '';
        }

        // Convert formatting tags to markdown-style markers
        // Process innermost tags first to preserve nested formatting

        // Strikethrough tags (process first - innermost)
        tmp.querySelectorAll('s, strike').forEach(el => {
            const innerHTML = el.innerHTML;
            const md = document.createElement('span');
            if (window.safeDOM) {
                window.safeDOM.setInnerHTML(md, `~~${innerHTML}~~`, true);
            } else {
                md.innerHTML = `~~${innerHTML}~~`;
            }
            while (md.firstChild) {
                el.parentNode.insertBefore(md.firstChild, el);
            }
            el.remove();
        });

        // Underline tags
        tmp.querySelectorAll('u').forEach(el => {
            const innerHTML = el.innerHTML;
            const md = document.createElement('span');
            if (window.safeDOM) {
                window.safeDOM.setInnerHTML(md, `__${innerHTML}__`, true);
            } else {
                md.innerHTML = `__${innerHTML}__`;
            }
            while (md.firstChild) {
                el.parentNode.insertBefore(md.firstChild, el);
            }
            el.remove();
        });

        // Italics tags
        tmp.querySelectorAll('i, em').forEach(el => {
            const innerHTML = el.innerHTML;
            const md = document.createElement('span');
            if (window.safeDOM) {
                window.safeDOM.setInnerHTML(md, `*${innerHTML}*`, true);
            } else {
                md.innerHTML = `*${innerHTML}*`;
            }
            while (md.firstChild) {
                el.parentNode.insertBefore(md.firstChild, el);
            }
            el.remove();
        });

        // Bold tags (process last - outermost)
        tmp.querySelectorAll('b, strong').forEach(el => {
            const innerHTML = el.innerHTML;
            const md = document.createElement('span');
            if (window.safeDOM) {
                window.safeDOM.setInnerHTML(md, `**${innerHTML}**`, true);
            } else {
                md.innerHTML = `**${innerHTML}**`;
            }
            while (md.firstChild) {
                el.parentNode.insertBefore(md.firstChild, el);
            }
            el.remove();
        });

        // Citation spans (preserve with special formatting) - process BEFORE color spans
        tmp.querySelectorAll('span[style*="font-style: italic"][style*="color"]').forEach(el => {
            const text = el.textContent;
            // Check if this looks like a citation (italic + secondary color)
            const style = el.getAttribute('style');
            if (style.includes('font-style: italic') && style.includes('var(--text-secondary)')) {
                // Mark as citation with special syntax
                const md = document.createTextNode(`{citation}${text}{/citation}`);
                el.replaceWith(md);
            } else {
                // Just unwrap if not a citation
                el.replaceWith(document.createTextNode(text));
            }
        });

        // Color spans (process AFTER citation spans to avoid conflicts)
        tmp.querySelectorAll('span[style*="color"]').forEach(el => {
            const text = el.textContent;
            const style = el.getAttribute('style');
            const colorMatch = style.match(/color:\s*([^;]+)/);
            if (colorMatch) {
                const color = colorMatch[1].trim();
                const md = document.createTextNode(`{color:${color}}${text}{/color}`);
                el.replaceWith(md);
            } else {
                // If no color found, just unwrap
                el.replaceWith(document.createTextNode(text));
            }
        });

        // Replace anchors with [text](href)
        tmp.querySelectorAll('a[href]').forEach(a => {
            const text = a.textContent || a.getAttribute('href');
            const href = a.getAttribute('href');
            const md = document.createTextNode(`[${text}](${href})`);
            a.replaceWith(md);
        });

        // Convert <br> to \n
        const htmlStr = tmp.innerHTML
            .replace(/<br\s*\/?>(?=\n)?/gi, '\n')
            .replace(/<br\s*\/?>(?!\n)/gi, '\n');

        // Strip remaining tags if any
        const text = htmlStr.replace(/<[^>]*>/g, '');

        // Decode entities by using textContent of a temp element
        const decode = document.createElement('textarea');
        if (window.safeDOM) {
            window.safeDOM.setInnerHTML(decode, text, false);
        } else {
            decode.innerHTML = text;
        }
        return decode.value;
    }

    // Convert markdown to HTML for display (similar to extension)
    buildContentHtml(content) {
        try {
            const escapeHtml = (s) => (s || '')
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;');

            let text = content || '';

            // Convert formatting markers to HTML (process outermost first to handle nesting)
            // Bold: **text** -> <b>text</b> (process first - outermost)
            text = text.replace(/\*\*([^*]*(?:\*(?!\*)[^*]*)*)\*\*/g, '<b>$1</b>');

            // Italics: *text* -> <i>text</i> (avoid conflict with bold)
            text = text.replace(/\*([^*]+)\*/g, '<i>$1</i>');

            // Underline: __text__ -> <u>text</u>
            text = text.replace(/__([^_]*(?:_(?!_)[^_]*)*?)__/g, '<u>$1</u>');

            // Strikethrough: ~~text~~ -> <s>text</s> (process last - innermost)
            text = text.replace(/~~([^~]*(?:~(?!~)[^~]*)*?)~~/g, '<s>$1</s>');

            // Color: {color:#ff0000}text{/color} -> <span style="color:#ff0000">text</span>
            // Sanitize color values to prevent XSS
            text = text.replace(/\{color:([^}]+)\}([^{]*)\{\/color\}/g, (match, color, content) => {
                // Only allow safe color formats: hex, rgb, rgba, hsl, hsla, and named colors
                const safeColor = this.sanitizeColor(color);
                if (safeColor) {
                    return `<span style="color:${safeColor}">${content}</span>`;
                }
                return content; // If color is unsafe, just return the content without styling
            });

            // Citation: {citation}text{/citation} -> <span style="font-style: italic; color: var(--text-secondary)">text</span>
            text = text.replace(/\{citation\}([^{]*)\{\/citation\}/g, '<span style="font-style: italic; color: var(--text-secondary)">$1</span>');

            const lines = text.split(/\r?\n/);
            const mdLink = /\[(.+?)\]\((https?:\/\/[^\s)]+)\)/g;
            const htmlLines = lines.map(line => {
                let out = '';
                let lastIndex = 0;
                let match;
                while ((match = mdLink.exec(line)) !== null) {
                    const beforeLink = line.slice(lastIndex, match.index);
                    out += this.escapeHtmlExceptTags(beforeLink);
                    const linkText = escapeHtml(match[1]);
                    const href = this.sanitizeUrl(match[2]); // Sanitize URL for XSS protection
                    if (href) {
                        out += `<a href="${href}" target="_blank" rel="noopener noreferrer">${linkText}</a>`;
                    } else {
                        out += linkText; // If URL is unsafe, just show the text
                    }
                    lastIndex = mdLink.lastIndex;
                }
                const afterLink = line.slice(lastIndex);
                out += this.escapeHtmlExceptTags(afterLink);
                return out;
            });
            return htmlLines.join('<br>');
        } catch (e) {
            return (content || '').replace(/\n/g, '<br>');
        }
    }

    // Sanitize color values to prevent XSS
    sanitizeColor(color) {
        if (!color) return null;

        const trimmedColor = color.trim();

        // Allow hex colors (#fff, #ffffff)
        if (/^#[0-9a-fA-F]{3}$|^#[0-9a-fA-F]{6}$/.test(trimmedColor)) {
            return trimmedColor;
        }

        // Allow rgb/rgba colors
        if (/^rgba?\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*(?:,\s*[0-9.]+\s*)?\)$/.test(trimmedColor)) {
            return trimmedColor;
        }

        // Allow hsl/hsla colors
        if (/^hsla?\(\s*\d+\s*,\s*\d+%\s*,\s*\d+%\s*(?:,\s*[0-9.]+\s*)?\)$/.test(trimmedColor)) {
            return trimmedColor;
        }

        // Allow CSS variables (for theme colors)
        if (/^var\(--[a-zA-Z0-9-]+\)$/.test(trimmedColor)) {
            return trimmedColor;
        }

        // Allow common named colors (basic set for safety)
        const safeNamedColors = [
            'black', 'white', 'red', 'green', 'blue', 'yellow', 'orange', 'purple',
            'pink', 'brown', 'gray', 'grey', 'cyan', 'magenta', 'lime', 'navy',
            'maroon', 'olive', 'teal', 'silver', 'gold'
        ];

        if (safeNamedColors.includes(trimmedColor.toLowerCase())) {
            return trimmedColor;
        }

        return null; // Unsafe color
    }

    // Sanitize URLs to prevent XSS
    sanitizeUrl(url) {
        if (!url) return null;

        try {
            const urlObj = new URL(url);
            // Only allow http and https protocols
            if (urlObj.protocol === 'http:' || urlObj.protocol === 'https:') {
                return url;
            }
        } catch (e) {
            // Invalid URL
        }

        return null; // Unsafe URL
    }

    escapeHtmlExceptTags(text) {
        // First escape all HTML
        let escaped = text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');

        // Then unescape our allowed formatting tags
        escaped = escaped
            .replace(/&lt;(\/?(?:b|i|u|s|span[^&]*))&gt;/gi, '<$1>')
            .replace(/&lt;span style=&quot;([^&]*)&quot;&gt;/gi, '<span style="$1">');

        return escaped;
    }

    // Set content in the editor
    setContent(content) {
        if (!this.contentElement) return;

        const safeContent = this.buildContentHtml(content || '');

        // Use safe DOM manipulation if available
        if (window.safeDOM) {
            window.safeDOM.setInnerHTML(this.contentElement, safeContent, true);
        } else {
            this.contentElement.innerHTML = safeContent;
        }
    }

    // Get content from the editor
    getContent() {
        if (!this.contentElement) return '';
        return this.htmlToMarkdown(this.contentElement.innerHTML);
    }
}

// Export for use in other modules
window.RichTextEditor = RichTextEditor;