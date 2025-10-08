/**
 * Input Validation Utility for Anchored Extension
 * Provides comprehensive input validation and sanitization
 */

class InputValidator {
    constructor() {
        this.maxLengths = {
            title: 500,
            content: 50000,
            tag: 50,
            tags: 20, // max number of tags
            url: 2048,
            domain: 253
        };

        this.patterns = {
            email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
            url: /^https?:\/\/.+/,
            domain: /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/,
            tag: /^[a-zA-Z0-9\s\-_]+$/,
            // Suspicious patterns that might indicate XSS attempts
            suspicious: [
                /<script[^>]*>/gi,
                /javascript:/gi,
                /vbscript:/gi,
                /on\w+\s*=/gi,
                /data:text\/html/gi,
                /expression\s*\(/gi,
                /<iframe[^>]*>/gi,
                /<object[^>]*>/gi,
                /<embed[^>]*>/gi,
                /<form[^>]*>/gi,
                /<meta[^>]*>/gi
            ]
        };
    }

    /**
     * Validate note title
     */
    validateTitle(title) {
        const result = {
            isValid: true,
            sanitized: '',
            errors: []
        };

        if (typeof title !== 'string') {
            result.isValid = false;
            result.errors.push('Title must be a string');
            return result;
        }

        // Trim whitespace
        let sanitized = title.trim();

        // Check length
        if (sanitized.length > this.maxLengths.title) {
            sanitized = sanitized.substring(0, this.maxLengths.title);
            result.errors.push(`Title truncated to ${this.maxLengths.title} characters`);
        }

        // Check for suspicious patterns
        const suspiciousFound = this.patterns.suspicious.some(pattern => pattern.test(sanitized));
        if (suspiciousFound) {
            result.isValid = false;
            result.errors.push('Title contains potentially malicious content');
            return result;
        }

        // Basic HTML escaping for titles (should be plain text)
        sanitized = this.escapeHtml(sanitized);

        result.sanitized = sanitized;
        return result;
    }

    /**
     * Validate note content
     */
    validateContent(content) {
        const result = {
            isValid: true,
            sanitized: '',
            errors: []
        };

        if (typeof content !== 'string') {
            result.isValid = false;
            result.errors.push('Content must be a string');
            return result;
        }

        let sanitized = content;

        // Check length
        if (sanitized.length > this.maxLengths.content) {
            sanitized = sanitized.substring(0, this.maxLengths.content);
            result.errors.push(`Content truncated to ${this.maxLengths.content} characters`);
        }

        // Use XSS prevention if available
        if (window.xssPrevention) {
            sanitized = window.xssPrevention.sanitizeRichText(sanitized);
        } else {
            // Fallback: check for suspicious patterns
            const suspiciousFound = this.patterns.suspicious.some(pattern => pattern.test(sanitized));
            if (suspiciousFound) {
                result.isValid = false;
                result.errors.push('Content contains potentially malicious content');
                return result;
            }
        }

        result.sanitized = sanitized;
        return result;
    }

    /**
     * Validate tags array
     */
    validateTags(tags) {
        const result = {
            isValid: true,
            sanitized: [],
            errors: []
        };

        if (!Array.isArray(tags)) {
            result.isValid = false;
            result.errors.push('Tags must be an array');
            return result;
        }

        // Check number of tags
        if (tags.length > this.maxLengths.tags) {
            result.errors.push(`Too many tags, limited to ${this.maxLengths.tags}`);
            tags = tags.slice(0, this.maxLengths.tags);
        }

        const sanitizedTags = [];

        for (const tag of tags) {
            if (typeof tag !== 'string') {
                result.errors.push('All tags must be strings');
                continue;
            }

            let sanitizedTag = tag.trim();

            // Check length
            if (sanitizedTag.length > this.maxLengths.tag) {
                sanitizedTag = sanitizedTag.substring(0, this.maxLengths.tag);
                result.errors.push(`Tag "${tag}" truncated`);
            }

            // Skip empty tags
            if (sanitizedTag.length === 0) {
                continue;
            }

            // Validate tag pattern
            if (!this.patterns.tag.test(sanitizedTag)) {
                result.errors.push(`Invalid tag format: "${sanitizedTag}"`);
                continue;
            }

            // Check for suspicious patterns
            const suspiciousFound = this.patterns.suspicious.some(pattern => pattern.test(sanitizedTag));
            if (suspiciousFound) {
                result.errors.push(`Tag contains potentially malicious content: "${sanitizedTag}"`);
                continue;
            }

            // Escape HTML
            sanitizedTag = this.escapeHtml(sanitizedTag);

            // Avoid duplicates
            if (!sanitizedTags.includes(sanitizedTag)) {
                sanitizedTags.push(sanitizedTag);
            }
        }

        result.sanitized = sanitizedTags;
        return result;
    }

    /**
     * Validate URL
     */
    validateUrl(url) {
        const result = {
            isValid: true,
            sanitized: '',
            errors: []
        };

        if (typeof url !== 'string') {
            result.isValid = false;
            result.errors.push('URL must be a string');
            return result;
        }

        let sanitized = url.trim();

        // Check length
        if (sanitized.length > this.maxLengths.url) {
            result.isValid = false;
            result.errors.push(`URL too long (max ${this.maxLengths.url} characters)`);
            return result;
        }

        // Check URL pattern
        if (!this.patterns.url.test(sanitized)) {
            result.isValid = false;
            result.errors.push('Invalid URL format');
            return result;
        }

        // Check for suspicious patterns
        const suspiciousFound = this.patterns.suspicious.some(pattern => pattern.test(sanitized));
        if (suspiciousFound) {
            result.isValid = false;
            result.errors.push('URL contains potentially malicious content');
            return result;
        }

        try {
            // Validate with URL constructor
            const urlObj = new URL(sanitized);

            // Only allow http and https protocols
            if (!['http:', 'https:'].includes(urlObj.protocol)) {
                result.isValid = false;
                result.errors.push('Only HTTP and HTTPS URLs are allowed');
                return result;
            }

            sanitized = urlObj.href;
        } catch (error) {
            result.isValid = false;
            result.errors.push('Invalid URL format');
            return result;
        }

        result.sanitized = sanitized;
        return result;
    }

    /**
     * Validate domain
     */
    validateDomain(domain) {
        const result = {
            isValid: true,
            sanitized: '',
            errors: []
        };

        if (typeof domain !== 'string') {
            result.isValid = false;
            result.errors.push('Domain must be a string');
            return result;
        }

        let sanitized = domain.trim().toLowerCase();

        // Check length
        if (sanitized.length > this.maxLengths.domain) {
            result.isValid = false;
            result.errors.push(`Domain too long (max ${this.maxLengths.domain} characters)`);
            return result;
        }

        // Check domain pattern
        if (!this.patterns.domain.test(sanitized)) {
            result.isValid = false;
            result.errors.push('Invalid domain format');
            return result;
        }

        // Check for suspicious patterns
        const suspiciousFound = this.patterns.suspicious.some(pattern => pattern.test(sanitized));
        if (suspiciousFound) {
            result.isValid = false;
            result.errors.push('Domain contains potentially malicious content');
            return result;
        }

        result.sanitized = sanitized;
        return result;
    }

    /**
     * Validate email address
     */
    validateEmail(email) {
        const result = {
            isValid: true,
            sanitized: '',
            errors: []
        };

        if (typeof email !== 'string') {
            result.isValid = false;
            result.errors.push('Email must be a string');
            return result;
        }

        let sanitized = email.trim().toLowerCase();

        // Check email pattern
        if (!this.patterns.email.test(sanitized)) {
            result.isValid = false;
            result.errors.push('Invalid email format');
            return result;
        }

        // Check for suspicious patterns
        const suspiciousFound = this.patterns.suspicious.some(pattern => pattern.test(sanitized));
        if (suspiciousFound) {
            result.isValid = false;
            result.errors.push('Email contains potentially malicious content');
            return result;
        }

        result.sanitized = sanitized;
        return result;
    }

    /**
     * Validate complete note object
     */
    validateNote(note) {
        const result = {
            isValid: true,
            sanitized: {},
            errors: []
        };

        if (!note || typeof note !== 'object') {
            result.isValid = false;
            result.errors.push('Note must be an object');
            return result;
        }

        // Validate each field
        const titleResult = this.validateTitle(note.title || '');
        const contentResult = this.validateContent(note.content || '');
        const tagsResult = this.validateTags(note.tags || []);
        const urlResult = this.validateUrl(note.url || '');
        const domainResult = this.validateDomain(note.domain || '');

        // Combine results
        result.isValid = titleResult.isValid && contentResult.isValid &&
            tagsResult.isValid && urlResult.isValid && domainResult.isValid;

        result.errors = [
            ...titleResult.errors,
            ...contentResult.errors,
            ...tagsResult.errors,
            ...urlResult.errors,
            ...domainResult.errors
        ];

        result.sanitized = {
            ...note,
            title: titleResult.sanitized,
            content: contentResult.sanitized,
            tags: tagsResult.sanitized,
            url: urlResult.sanitized,
            domain: domainResult.sanitized
        };

        return result;
    }

    /**
     * Basic HTML escaping
     */
    escapeHtml(text) {
        if (typeof text !== 'string') return '';

        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    /**
     * Check if input contains suspicious patterns
     */
    containsSuspiciousContent(input) {
        if (typeof input !== 'string') return false;

        return this.patterns.suspicious.some(pattern => pattern.test(input));
    }

    /**
     * Sanitize user input for safe display
     */
    sanitizeForDisplay(input, allowRichText = false) {
        if (typeof input !== 'string') return '';

        if (allowRichText && window.xssPrevention) {
            return window.xssPrevention.sanitizeRichText(input);
        } else {
            return this.escapeHtml(input);
        }
    }

    /**
     * Rate limiting for input validation
     */
    createRateLimiter(maxCalls = 100, windowMs = 60000) {
        const calls = [];

        return () => {
            const now = Date.now();

            // Remove old calls outside the window
            while (calls.length > 0 && calls[0] < now - windowMs) {
                calls.shift();
            }

            // Check if we've exceeded the limit
            if (calls.length >= maxCalls) {
                return false;
            }

            calls.push(now);
            return true;
        };
    }
}

// Create global instance
window.inputValidator = new InputValidator();

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = InputValidator;
}