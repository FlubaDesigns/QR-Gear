/**
 * QR Gear Embeddable Widget
 * Drop this script on any page to embed the QR Gear mini-store
 * 
 * PLACEMENT TYPES:
 * - homepage: General products for all visitors
 * - church: Church-specific products (requires data-church-id)
 * - business: Business-specific products (requires data-business-id)
 * - member: Member dashboard products (requires data-member-id)
 * 
 * HOMEPAGE EMBED:
 * <div id="qrgear-widget" 
 *      data-token="your-pre-signed-jwt-token"
 *      data-placement="homepage"></div>
 * 
 * CHURCH PAGE EMBED:
 * <div id="qrgear-widget" 
 *      data-token="your-pre-signed-jwt-token"
 *      data-placement="church"
 *      data-church-id="faith-community"></div>
 * 
 * BUSINESS PAGE EMBED:
 * <div id="qrgear-widget" 
 *      data-token="your-pre-signed-jwt-token"
 *      data-placement="business"
 *      data-business-id="joes-plumbing"></div>
 * 
 * MEMBER DASHBOARD EMBED:
 * <div id="qrgear-widget" 
 *      data-token="your-pre-signed-jwt-token"
 *      data-placement="member"
 *      data-member-id="user@email.com"></div>
 * 
 * Or initialize programmatically:
 * QRGear.init({
 *   container: '#qrgear-widget',
 *   token: 'your-pre-signed-jwt-token',
 *   placement: 'church',           // homepage, church, business, member
 *   churchId: 'faith-community',   // For church placement
 *   businessId: 'joes-plumbing',   // For business placement
 *   memberId: 'user@email.com',    // For member placement
 *   segment: 'religious',          // Optional: filter by segment
 *   partnerId: 'kingdom-connects', // Optional: use partner's product catalog
 *   theme: 'light',
 *   height: 600,
 *   onReady: function() { console.log('Widget loaded'); },
 *   onOrder: function(data) { console.log('Order started', data); }
 * });
 * 
 * Available segments: 'religious', 'business', 'custom'
 * Segments are configured per partner in the admin panel.
 */
(function(window, document) {
  'use strict';

  var WIDGET_BASE_URL = window.QRGEAR_BASE_URL || (function() {
    var scripts = document.getElementsByTagName('script');
    for (var i = 0; i < scripts.length; i++) {
      var src = scripts[i].src;
      if (src && src.indexOf('qrgear-embed.js') > -1) {
        return src.replace(/\/embed\/qrgear-embed\.js.*$/, '');
      }
    }
    return '';
  })();

  var QRGear = {
    version: '1.0.0',
    widgets: [],

    init: function(options) {
      var config = this._normalizeOptions(options);
      if (!config.container) {
        console.error('QRGear: No container specified');
        return null;
      }

      var container = typeof config.container === 'string' 
        ? document.querySelector(config.container) 
        : config.container;

      if (!container) {
        console.error('QRGear: Container not found:', config.container);
        return null;
      }

      return this._createWidget(container, config);
    },

    _normalizeOptions: function(options) {
      return {
        container: options.container || options.el,
        token: options.token,
        placement: options.placement || 'homepage',
        churchId: options.churchId || null,
        businessId: options.businessId || null,
        memberId: options.memberId || null,
        segment: options.segment || null,
        partnerId: options.partnerId || null,
        theme: options.theme || 'auto',
        height: options.height || 600,
        compact: options.compact !== false,
        onReady: options.onReady || function() {},
        onOrder: options.onOrder || function() {},
        onError: options.onError || function() {}
      };
    },

    _createWidget: function(container, config) {
      var self = this;
      var widgetId = 'qrgear-widget-' + Date.now();

      if (!config.token) {
        container.innerHTML = '<div class="qrgear-error">Widget requires a pre-signed token. Contact your administrator.</div>';
        config.onError(new Error('Missing token'));
        return null;
      }

      container.innerHTML = '';
      container.style.position = 'relative';
      container.style.minHeight = config.height + 'px';

      var loader = document.createElement('div');
      loader.className = 'qrgear-loader';
      loader.innerHTML = '<div class="qrgear-spinner"></div><p>Loading QR Gear...</p>';
      container.appendChild(loader);

      this._injectStyles();

      loader.remove();

      var iframe = document.createElement('iframe');
      iframe.id = widgetId;
      iframe.className = 'qrgear-iframe';
      var iframeSrc = WIDGET_BASE_URL + '/widget?token=' + encodeURIComponent(config.token) + 
                   '&compact=' + config.compact +
                   '&theme=' + config.theme +
                   '&placement=' + encodeURIComponent(config.placement);
      if (config.segment) {
        iframeSrc += '&segment=' + encodeURIComponent(config.segment);
      }
      if (config.partnerId) {
        iframeSrc += '&partnerId=' + encodeURIComponent(config.partnerId);
      }
      if (config.churchId) {
        iframeSrc += '&churchId=' + encodeURIComponent(config.churchId);
      }
      if (config.businessId) {
        iframeSrc += '&businessId=' + encodeURIComponent(config.businessId);
      }
      if (config.memberId) {
        iframeSrc += '&memberId=' + encodeURIComponent(config.memberId);
      }
      iframe.src = iframeSrc;
      iframe.style.width = '100%';
      iframe.style.height = config.height + 'px';
      iframe.style.border = 'none';
      iframe.style.borderRadius = '12px';
      iframe.setAttribute('allowtransparency', 'true');
      iframe.setAttribute('loading', 'lazy');

      container.appendChild(iframe);

      self._setupMessageHandler(iframe, config);
      
      iframe.onload = function() {
        config.onReady();
      };

      self.widgets.push({
        id: widgetId,
        iframe: iframe,
        config: config
      });

      return {
        destroy: function() {
          container.innerHTML = '';
          self.widgets = self.widgets.filter(function(w) { return w.id !== widgetId; });
        },
        resize: function(height) {
          var iframeEl = document.getElementById(widgetId);
          if (iframeEl) iframeEl.style.height = height + 'px';
        }
      };
    },

    _setupMessageHandler: function(iframe, config) {
      var self = this;
      window.addEventListener('message', function(event) {
        if (event.source !== iframe.contentWindow) return;
        
        if (!self._isAllowedOrigin(event.origin)) {
          console.warn('QRGear: Message from unauthorized origin:', event.origin);
          return;
        }

        var data = event.data;
        if (!data || !data.type) return;

        switch (data.type) {
          case 'qrgear-widget-navigate':
            if (data.url) {
              window.open(WIDGET_BASE_URL + data.url, '_blank');
            }
            break;

          case 'qrgear-design-complete':
            config.onOrder(data.design);
            break;

          case 'qrgear-resize':
            if (data.height) {
              iframe.style.height = data.height + 'px';
            }
            break;

          case 'qrgear-ready':
            config.onReady();
            break;
        }
      });
    },

    _isAllowedOrigin: function(origin) {
      if (!origin) return false;
      try {
        var widgetOrigin = new URL(WIDGET_BASE_URL).origin;
        return origin === widgetOrigin;
      } catch (e) {
        return false;
      }
    },

    _injectStyles: function() {
      if (document.getElementById('qrgear-embed-styles')) return;

      var styles = document.createElement('style');
      styles.id = 'qrgear-embed-styles';
      styles.textContent = [
        '.qrgear-loader {',
        '  display: flex;',
        '  flex-direction: column;',
        '  align-items: center;',
        '  justify-content: center;',
        '  height: 200px;',
        '  color: #666;',
        '  font-family: system-ui, sans-serif;',
        '}',
        '.qrgear-spinner {',
        '  width: 40px;',
        '  height: 40px;',
        '  border: 3px solid #e0e0e0;',
        '  border-top-color: #3b82f6;',
        '  border-radius: 50%;',
        '  animation: qrgear-spin 1s linear infinite;',
        '}',
        '@keyframes qrgear-spin {',
        '  to { transform: rotate(360deg); }',
        '}',
        '.qrgear-error {',
        '  padding: 20px;',
        '  text-align: center;',
        '  color: #ef4444;',
        '  font-family: system-ui, sans-serif;',
        '}',
        '.qrgear-iframe {',
        '  transition: height 0.3s ease;',
        '}'
      ].join('\n');

      document.head.appendChild(styles);
    }
  };

  function autoInit() {
    var containers = document.querySelectorAll('[data-qrgear], #qrgear-widget, .qrgear-widget');
    
    containers.forEach(function(container) {
      var config = {
        container: container,
        token: container.dataset.token,
        placement: container.dataset.placement || 'homepage',
        churchId: container.dataset.churchId || null,
        businessId: container.dataset.businessId || null,
        memberId: container.dataset.memberId || null,
        segment: container.dataset.segment || null,
        partnerId: container.dataset.partnerId || container.dataset.partner || null,
        theme: container.dataset.theme || 'auto',
        height: parseInt(container.dataset.height) || 600,
        compact: container.dataset.compact !== 'false'
      };

      if (config.token) {
        QRGear.init(config);
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', autoInit);
  } else {
    autoInit();
  }

  window.QRGear = QRGear;

})(window, document);
