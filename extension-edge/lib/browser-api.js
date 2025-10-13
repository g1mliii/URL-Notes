// Browser API Abstraction Layer for Edge
// Provides unified interface for Chrome/Edge WebExtensions APIs
// Edge uses the same chrome.* namespace as Chrome, so this is mostly a passthrough
// with some Edge-specific compatibility handling

(function () {
  'use strict';

  // Edge uses chrome.* namespace like Chrome, but may have some differences
  const isEdge = navigator.userAgent.indexOf('Edg/') > -1;

  // Create unified API object (mostly passthrough for Edge)
  const browserAPI = {
    // Storage API - Edge uses chrome.storage
    storage: {
      local: {
        get: function (keys) {
          return new Promise((resolve, reject) => {
            chrome.storage.local.get(keys, (result) => {
              if (chrome.runtime.lastError) {
                reject(chrome.runtime.lastError);
              } else {
                resolve(result);
              }
            });
          });
        },

        set: function (items) {
          return new Promise((resolve, reject) => {
            chrome.storage.local.set(items, () => {
              if (chrome.runtime.lastError) {
                reject(chrome.runtime.lastError);
              } else {
                resolve();
              }
            });
          });
        },

        remove: function (keys) {
          return new Promise((resolve, reject) => {
            chrome.storage.local.remove(keys, () => {
              if (chrome.runtime.lastError) {
                reject(chrome.runtime.lastError);
              } else {
                resolve();
              }
            });
          });
        },

        clear: function () {
          return new Promise((resolve, reject) => {
            chrome.storage.local.clear(() => {
              if (chrome.runtime.lastError) {
                reject(chrome.runtime.lastError);
              } else {
                resolve();
              }
            });
          });
        }
      },

      session: {
        get: function (keys) {
          return new Promise((resolve, reject) => {
            if (chrome.storage.session) {
              chrome.storage.session.get(keys, (result) => {
                if (chrome.runtime.lastError) {
                  reject(chrome.runtime.lastError);
                } else {
                  resolve(result);
                }
              });
            } else {
              // Fallback to local storage if session not supported
              chrome.storage.local.get(keys, (result) => {
                if (chrome.runtime.lastError) {
                  reject(chrome.runtime.lastError);
                } else {
                  resolve(result);
                }
              });
            }
          });
        },

        set: function (items) {
          return new Promise((resolve, reject) => {
            if (chrome.storage.session) {
              chrome.storage.session.set(items, () => {
                if (chrome.runtime.lastError) {
                  reject(chrome.runtime.lastError);
                } else {
                  resolve();
                }
              });
            } else {
              chrome.storage.local.set(items, () => {
                if (chrome.runtime.lastError) {
                  reject(chrome.runtime.lastError);
                } else {
                  resolve();
                }
              });
            }
          });
        },

        remove: function (keys) {
          return new Promise((resolve, reject) => {
            if (chrome.storage.session) {
              chrome.storage.session.remove(keys, () => {
                if (chrome.runtime.lastError) {
                  reject(chrome.runtime.lastError);
                } else {
                  resolve();
                }
              });
            } else {
              chrome.storage.local.remove(keys, () => {
                if (chrome.runtime.lastError) {
                  reject(chrome.runtime.lastError);
                } else {
                  resolve();
                }
              });
            }
          });
        }
      },

      onChanged: {
        addListener: function (callback) {
          chrome.storage.onChanged.addListener(callback);
        },

        removeListener: function (callback) {
          chrome.storage.onChanged.removeListener(callback);
        }
      }
    },

    // Tabs API - Edge uses chrome.tabs
    tabs: {
      query: function (queryInfo) {
        return new Promise((resolve, reject) => {
          chrome.tabs.query(queryInfo, (tabs) => {
            if (chrome.runtime.lastError) {
              reject(chrome.runtime.lastError);
            } else {
              resolve(tabs);
            }
          });
        });
      },

      get: function (tabId) {
        return new Promise((resolve, reject) => {
          chrome.tabs.get(tabId, (tab) => {
            if (chrome.runtime.lastError) {
              reject(chrome.runtime.lastError);
            } else {
              resolve(tab);
            }
          });
        });
      },

      create: function (createProperties) {
        return new Promise((resolve, reject) => {
          chrome.tabs.create(createProperties, (tab) => {
            if (chrome.runtime.lastError) {
              reject(chrome.runtime.lastError);
            } else {
              resolve(tab);
            }
          });
        });
      },

      update: function (tabId, updateProperties) {
        return new Promise((resolve, reject) => {
          chrome.tabs.update(tabId, updateProperties, (tab) => {
            if (chrome.runtime.lastError) {
              reject(chrome.runtime.lastError);
            } else {
              resolve(tab);
            }
          });
        });
      },

      sendMessage: function (tabId, message) {
        return new Promise((resolve, reject) => {
          chrome.tabs.sendMessage(tabId, message, (response) => {
            if (chrome.runtime.lastError) {
              reject(chrome.runtime.lastError);
            } else {
              resolve(response);
            }
          });
        });
      },

      onUpdated: {
        addListener: function (callback) {
          chrome.tabs.onUpdated.addListener(callback);
        },

        removeListener: function (callback) {
          chrome.tabs.onUpdated.removeListener(callback);
        }
      },

      onRemoved: {
        addListener: function (callback) {
          chrome.tabs.onRemoved.addListener(callback);
        },

        removeListener: function (callback) {
          chrome.tabs.onRemoved.removeListener(callback);
        }
      }
    },

    // Runtime API - Edge uses chrome.runtime
    runtime: {
      sendMessage: function (message) {
        return new Promise((resolve, reject) => {
          chrome.runtime.sendMessage(message, (response) => {
            if (chrome.runtime.lastError) {
              reject(chrome.runtime.lastError);
            } else {
              resolve(response);
            }
          });
        });
      },

      getURL: function (path) {
        return chrome.runtime.getURL(path);
      },

      onMessage: {
        addListener: function (callback) {
          chrome.runtime.onMessage.addListener(callback);
        },

        removeListener: function (callback) {
          chrome.runtime.onMessage.removeListener(callback);
        }
      },

      onInstalled: {
        addListener: function (callback) {
          chrome.runtime.onInstalled.addListener(callback);
        }
      },

      onStartup: {
        addListener: function (callback) {
          chrome.runtime.onStartup.addListener(callback);
        }
      },

      lastError: {
        get: function () {
          return chrome.runtime.lastError;
        }
      },

      setUninstallURL: function (url) {
        return new Promise((resolve, reject) => {
          chrome.runtime.setUninstallURL(url, () => {
            if (chrome.runtime.lastError) {
              reject(chrome.runtime.lastError);
            } else {
              resolve();
            }
          });
        });
      }
    },

    // Context Menus API - Edge uses chrome.contextMenus
    contextMenus: {
      create: function (createProperties, callback) {
        return new Promise((resolve, reject) => {
          const id = chrome.contextMenus.create(createProperties, () => {
            if (chrome.runtime.lastError) {
              if (callback) callback();
              reject(chrome.runtime.lastError);
            } else {
              if (callback) callback();
              resolve(id);
            }
          });
        });
      },

      removeAll: function (callback) {
        return new Promise((resolve, reject) => {
          chrome.contextMenus.removeAll(() => {
            if (chrome.runtime.lastError) {
              reject(chrome.runtime.lastError);
            } else {
              if (callback) callback();
              resolve();
            }
          });
        });
      },

      onClicked: {
        addListener: function (callback) {
          chrome.contextMenus.onClicked.addListener(callback);
        },

        removeListener: function (callback) {
          chrome.contextMenus.onClicked.removeListener(callback);
        }
      }
    },

    // Alarms API - Edge uses chrome.alarms
    alarms: {
      create: function (name, alarmInfo) {
        chrome.alarms.create(name, alarmInfo);
        return Promise.resolve();
      },

      clear: function (name) {
        return new Promise((resolve, reject) => {
          chrome.alarms.clear(name, (wasCleared) => {
            if (chrome.runtime.lastError) {
              reject(chrome.runtime.lastError);
            } else {
              resolve(wasCleared);
            }
          });
        });
      },

      clearAll: function () {
        return new Promise((resolve, reject) => {
          chrome.alarms.clearAll((wasCleared) => {
            if (chrome.runtime.lastError) {
              reject(chrome.runtime.lastError);
            } else {
              resolve(wasCleared);
            }
          });
        });
      },

      get: function (name) {
        return new Promise((resolve, reject) => {
          chrome.alarms.get(name, (alarm) => {
            if (chrome.runtime.lastError) {
              reject(chrome.runtime.lastError);
            } else {
              resolve(alarm);
            }
          });
        });
      },

      getAll: function () {
        return new Promise((resolve, reject) => {
          chrome.alarms.getAll((alarms) => {
            if (chrome.runtime.lastError) {
              reject(chrome.runtime.lastError);
            } else {
              resolve(alarms);
            }
          });
        });
      },

      onAlarm: {
        addListener: function (callback) {
          chrome.alarms.onAlarm.addListener(callback);
        },

        removeListener: function (callback) {
          chrome.alarms.onAlarm.removeListener(callback);
        }
      }
    },

    // Action API - Edge uses chrome.action (MV3)
    action: {
      openPopup: function () {
        if (chrome.action && chrome.action.openPopup) {
          return new Promise((resolve, reject) => {
            chrome.action.openPopup(() => {
              if (chrome.runtime.lastError) {
                reject(chrome.runtime.lastError);
              } else {
                resolve();
              }
            });
          });
        }
        return Promise.reject(new Error('openPopup not supported'));
      },

      setBadgeText: function (details) {
        if (chrome.action) {
          return new Promise((resolve, reject) => {
            chrome.action.setBadgeText(details, () => {
              if (chrome.runtime.lastError) {
                reject(chrome.runtime.lastError);
              } else {
                resolve();
              }
            });
          });
        }
        return Promise.resolve();
      },

      setBadgeBackgroundColor: function (details) {
        if (chrome.action) {
          return new Promise((resolve, reject) => {
            chrome.action.setBadgeBackgroundColor(details, () => {
              if (chrome.runtime.lastError) {
                reject(chrome.runtime.lastError);
              } else {
                resolve();
              }
            });
          });
        }
        return Promise.resolve();
      }
    },

    // Commands API - Edge uses chrome.commands
    commands: {
      getAll: function () {
        return new Promise((resolve, reject) => {
          chrome.commands.getAll((commands) => {
            if (chrome.runtime.lastError) {
              reject(chrome.runtime.lastError);
            } else {
              resolve(commands);
            }
          });
        });
      },

      onCommand: {
        addListener: function (callback) {
          chrome.commands.onCommand.addListener(callback);
        }
      }
    },

    // Identity API - Edge uses chrome.identity
    identity: {
      getRedirectURL: function (path) {
        return chrome.identity.getRedirectURL(path);
      }
    },

    // Notifications API - Edge uses chrome.notifications
    notifications: {
      create: function (notificationId, options) {
        return new Promise((resolve, reject) => {
          chrome.notifications.create(notificationId, options, (id) => {
            if (chrome.runtime.lastError) {
              reject(chrome.runtime.lastError);
            } else {
              resolve(id);
            }
          });
        });
      },

      clear: function (notificationId) {
        return new Promise((resolve, reject) => {
          chrome.notifications.clear(notificationId, (wasCleared) => {
            if (chrome.runtime.lastError) {
              reject(chrome.runtime.lastError);
            } else {
              resolve(wasCleared);
            }
          });
        });
      },

      onClicked: {
        addListener: function (callback) {
          chrome.notifications.onClicked.addListener(callback);
        }
      }
    },

    // Scripting API - Edge uses chrome.scripting (MV3)
    scripting: {
      executeScript: function (injection) {
        return new Promise((resolve, reject) => {
          chrome.scripting.executeScript(injection, (results) => {
            if (chrome.runtime.lastError) {
              reject(chrome.runtime.lastError);
            } else {
              resolve(results);
            }
          });
        });
      }
    }
  };

  // Export to global scope
  // In service workers, use 'self' instead of 'window'
  if (typeof self !== 'undefined') {
    self.browserAPI = browserAPI;
  }

  // Also support window for content scripts and popup
  if (typeof window !== 'undefined') {
    window.browserAPI = browserAPI;
  }

  // Also make it available as a module export if needed
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = browserAPI;
  }
})();
