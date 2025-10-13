// Browser API Abstraction Layer for Firefox
// Provides unified interface for Chrome/Firefox WebExtensions APIs
// This wrapper handles the differences between chrome.* and browser.* namespaces

(function() {
  'use strict';

  // Detect browser environment
  const isFirefox = typeof browser !== 'undefined' && browser.runtime;
  const isChrome = typeof chrome !== 'undefined' && chrome.runtime;

  // Create unified API object
  const browserAPI = {
    // Storage API - handles chrome.storage vs browser.storage
    storage: {
      local: {
        get: function(keys) {
          if (isFirefox) {
            // Firefox uses promises natively
            return browser.storage.local.get(keys);
          } else {
            // Chrome uses callbacks, wrap in promise
            return new Promise((resolve, reject) => {
              chrome.storage.local.get(keys, (result) => {
                if (chrome.runtime.lastError) {
                  reject(chrome.runtime.lastError);
                } else {
                  resolve(result);
                }
              });
            });
          }
        },

        set: function(items) {
          if (isFirefox) {
            return browser.storage.local.set(items);
          } else {
            return new Promise((resolve, reject) => {
              chrome.storage.local.set(items, () => {
                if (chrome.runtime.lastError) {
                  reject(chrome.runtime.lastError);
                } else {
                  resolve();
                }
              });
            });
          }
        },

        remove: function(keys) {
          if (isFirefox) {
            return browser.storage.local.remove(keys);
          } else {
            return new Promise((resolve, reject) => {
              chrome.storage.local.remove(keys, () => {
                if (chrome.runtime.lastError) {
                  reject(chrome.runtime.lastError);
                } else {
                  resolve();
                }
              });
            });
          }
        },

        clear: function() {
          if (isFirefox) {
            return browser.storage.local.clear();
          } else {
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
        }
      },

      session: {
        get: function(keys) {
          if (isFirefox) {
            // Firefox may not support storage.session, fallback to local
            if (browser.storage.session) {
              return browser.storage.session.get(keys);
            } else {
              return browser.storage.local.get(keys);
            }
          } else {
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
                // Fallback to local storage
                chrome.storage.local.get(keys, (result) => {
                  if (chrome.runtime.lastError) {
                    reject(chrome.runtime.lastError);
                  } else {
                    resolve(result);
                  }
                });
              }
            });
          }
        },

        set: function(items) {
          if (isFirefox) {
            if (browser.storage.session) {
              return browser.storage.session.set(items);
            } else {
              return browser.storage.local.set(items);
            }
          } else {
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
          }
        },

        remove: function(keys) {
          if (isFirefox) {
            if (browser.storage.session) {
              return browser.storage.session.remove(keys);
            } else {
              return browser.storage.local.remove(keys);
            }
          } else {
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
        }
      },

      onChanged: {
        addListener: function(callback) {
          if (isFirefox) {
            browser.storage.onChanged.addListener(callback);
          } else {
            chrome.storage.onChanged.addListener(callback);
          }
        },

        removeListener: function(callback) {
          if (isFirefox) {
            browser.storage.onChanged.removeListener(callback);
          } else {
            chrome.storage.onChanged.removeListener(callback);
          }
        }
      }
    },

    // Tabs API - handles chrome.tabs vs browser.tabs
    tabs: {
      query: function(queryInfo) {
        if (isFirefox) {
          return browser.tabs.query(queryInfo);
        } else {
          return new Promise((resolve, reject) => {
            chrome.tabs.query(queryInfo, (tabs) => {
              if (chrome.runtime.lastError) {
                reject(chrome.runtime.lastError);
              } else {
                resolve(tabs);
              }
            });
          });
        }
      },

      get: function(tabId) {
        if (isFirefox) {
          return browser.tabs.get(tabId);
        } else {
          return new Promise((resolve, reject) => {
            chrome.tabs.get(tabId, (tab) => {
              if (chrome.runtime.lastError) {
                reject(chrome.runtime.lastError);
              } else {
                resolve(tab);
              }
            });
          });
        }
      },

      create: function(createProperties) {
        if (isFirefox) {
          return browser.tabs.create(createProperties);
        } else {
          return new Promise((resolve, reject) => {
            chrome.tabs.create(createProperties, (tab) => {
              if (chrome.runtime.lastError) {
                reject(chrome.runtime.lastError);
              } else {
                resolve(tab);
              }
            });
          });
        }
      },

      update: function(tabId, updateProperties) {
        if (isFirefox) {
          return browser.tabs.update(tabId, updateProperties);
        } else {
          return new Promise((resolve, reject) => {
            chrome.tabs.update(tabId, updateProperties, (tab) => {
              if (chrome.runtime.lastError) {
                reject(chrome.runtime.lastError);
              } else {
                resolve(tab);
              }
            });
          });
        }
      },

      sendMessage: function(tabId, message) {
        if (isFirefox) {
          return browser.tabs.sendMessage(tabId, message);
        } else {
          return new Promise((resolve, reject) => {
            chrome.tabs.sendMessage(tabId, message, (response) => {
              if (chrome.runtime.lastError) {
                reject(chrome.runtime.lastError);
              } else {
                resolve(response);
              }
            });
          });
        }
      },

      onUpdated: {
        addListener: function(callback) {
          if (isFirefox) {
            browser.tabs.onUpdated.addListener(callback);
          } else {
            chrome.tabs.onUpdated.addListener(callback);
          }
        },

        removeListener: function(callback) {
          if (isFirefox) {
            browser.tabs.onUpdated.removeListener(callback);
          } else {
            chrome.tabs.onUpdated.removeListener(callback);
          }
        }
      },

      onRemoved: {
        addListener: function(callback) {
          if (isFirefox) {
            browser.tabs.onRemoved.addListener(callback);
          } else {
            chrome.tabs.onRemoved.addListener(callback);
          }
        },

        removeListener: function(callback) {
          if (isFirefox) {
            browser.tabs.onRemoved.removeListener(callback);
          } else {
            chrome.tabs.onRemoved.removeListener(callback);
          }
        }
      }
    },

    // Runtime API - handles chrome.runtime vs browser.runtime
    runtime: {
      sendMessage: function(message) {
        if (isFirefox) {
          return browser.runtime.sendMessage(message);
        } else {
          return new Promise((resolve, reject) => {
            chrome.runtime.sendMessage(message, (response) => {
              if (chrome.runtime.lastError) {
                reject(chrome.runtime.lastError);
              } else {
                resolve(response);
              }
            });
          });
        }
      },

      getURL: function(path) {
        if (isFirefox) {
          return browser.runtime.getURL(path);
        } else {
          return chrome.runtime.getURL(path);
        }
      },

      onMessage: {
        addListener: function(callback) {
          if (isFirefox) {
            browser.runtime.onMessage.addListener((message, sender) => {
              // Firefox expects a promise or undefined for async responses
              const result = callback(message, sender, (response) => {
                return Promise.resolve(response);
              });
              // If callback returns a promise, return it
              if (result instanceof Promise) {
                return result;
              }
              // If callback returns true, it wants to send async response
              if (result === true) {
                return true;
              }
            });
          } else {
            chrome.runtime.onMessage.addListener(callback);
          }
        },

        removeListener: function(callback) {
          if (isFirefox) {
            browser.runtime.onMessage.removeListener(callback);
          } else {
            chrome.runtime.onMessage.removeListener(callback);
          }
        }
      },

      onInstalled: {
        addListener: function(callback) {
          if (isFirefox) {
            browser.runtime.onInstalled.addListener(callback);
          } else {
            chrome.runtime.onInstalled.addListener(callback);
          }
        }
      },

      onStartup: {
        addListener: function(callback) {
          if (isFirefox) {
            browser.runtime.onStartup.addListener(callback);
          } else {
            chrome.runtime.onStartup.addListener(callback);
          }
        }
      },

      lastError: {
        get: function() {
          if (isFirefox) {
            return browser.runtime.lastError;
          } else {
            return chrome.runtime.lastError;
          }
        }
      },

      setUninstallURL: function(url) {
        if (isFirefox) {
          return browser.runtime.setUninstallURL(url);
        } else {
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
      }
    },

    // Context Menus API - handles chrome.contextMenus vs browser.contextMenus (or browser.menus)
    contextMenus: {
      create: function(createProperties, callback) {
        if (isFirefox) {
          // Firefox uses browser.menus or browser.contextMenus
          const menusAPI = browser.menus || browser.contextMenus;
          return new Promise((resolve, reject) => {
            try {
              const id = menusAPI.create(createProperties);
              if (callback) callback();
              resolve(id);
            } catch (error) {
              reject(error);
            }
          });
        } else {
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
        }
      },

      removeAll: function(callback) {
        if (isFirefox) {
          const menusAPI = browser.menus || browser.contextMenus;
          return menusAPI.removeAll().then(() => {
            if (callback) callback();
          });
        } else {
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
        }
      },

      onClicked: {
        addListener: function(callback) {
          if (isFirefox) {
            const menusAPI = browser.menus || browser.contextMenus;
            menusAPI.onClicked.addListener(callback);
          } else {
            chrome.contextMenus.onClicked.addListener(callback);
          }
        },

        removeListener: function(callback) {
          if (isFirefox) {
            const menusAPI = browser.menus || browser.contextMenus;
            menusAPI.onClicked.removeListener(callback);
          } else {
            chrome.contextMenus.onClicked.removeListener(callback);
          }
        }
      }
    },

    // Alarms API - handles chrome.alarms vs browser.alarms
    alarms: {
      create: function(name, alarmInfo) {
        if (isFirefox) {
          return browser.alarms.create(name, alarmInfo);
        } else {
          chrome.alarms.create(name, alarmInfo);
          return Promise.resolve();
        }
      },

      clear: function(name) {
        if (isFirefox) {
          return browser.alarms.clear(name);
        } else {
          return new Promise((resolve, reject) => {
            chrome.alarms.clear(name, (wasCleared) => {
              if (chrome.runtime.lastError) {
                reject(chrome.runtime.lastError);
              } else {
                resolve(wasCleared);
              }
            });
          });
        }
      },

      clearAll: function() {
        if (isFirefox) {
          return browser.alarms.clearAll();
        } else {
          return new Promise((resolve, reject) => {
            chrome.alarms.clearAll((wasCleared) => {
              if (chrome.runtime.lastError) {
                reject(chrome.runtime.lastError);
              } else {
                resolve(wasCleared);
              }
            });
          });
        }
      },

      get: function(name) {
        if (isFirefox) {
          return browser.alarms.get(name);
        } else {
          return new Promise((resolve, reject) => {
            chrome.alarms.get(name, (alarm) => {
              if (chrome.runtime.lastError) {
                reject(chrome.runtime.lastError);
              } else {
                resolve(alarm);
              }
            });
          });
        }
      },

      getAll: function() {
        if (isFirefox) {
          return browser.alarms.getAll();
        } else {
          return new Promise((resolve, reject) => {
            chrome.alarms.getAll((alarms) => {
              if (chrome.runtime.lastError) {
                reject(chrome.runtime.lastError);
              } else {
                resolve(alarms);
              }
            });
          });
        }
      },

      onAlarm: {
        addListener: function(callback) {
          if (isFirefox) {
            browser.alarms.onAlarm.addListener(callback);
          } else {
            chrome.alarms.onAlarm.addListener(callback);
          }
        },

        removeListener: function(callback) {
          if (isFirefox) {
            browser.alarms.onAlarm.removeListener(callback);
          } else {
            chrome.alarms.onAlarm.removeListener(callback);
          }
        }
      }
    },

    // Action API - handles chrome.action vs browser.browserAction (Firefox MV2)
    action: {
      openPopup: function() {
        if (isFirefox) {
          // Firefox MV2 uses browserAction
          if (browser.browserAction && browser.browserAction.openPopup) {
            return browser.browserAction.openPopup();
          }
          return Promise.reject(new Error('openPopup not supported'));
        } else {
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
        }
      },

      setBadgeText: function(details) {
        if (isFirefox) {
          if (browser.browserAction) {
            return browser.browserAction.setBadgeText(details);
          }
          return Promise.resolve();
        } else {
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
        }
      },

      setBadgeBackgroundColor: function(details) {
        if (isFirefox) {
          if (browser.browserAction) {
            return browser.browserAction.setBadgeBackgroundColor(details);
          }
          return Promise.resolve();
        } else {
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
      }
    },

    // Commands API - handles chrome.commands vs browser.commands
    commands: {
      getAll: function() {
        if (isFirefox) {
          return browser.commands.getAll();
        } else {
          return new Promise((resolve, reject) => {
            chrome.commands.getAll((commands) => {
              if (chrome.runtime.lastError) {
                reject(chrome.runtime.lastError);
              } else {
                resolve(commands);
              }
            });
          });
        }
      },

      onCommand: {
        addListener: function(callback) {
          if (isFirefox) {
            browser.commands.onCommand.addListener(callback);
          } else {
            chrome.commands.onCommand.addListener(callback);
          }
        }
      }
    },

    // Identity API - handles chrome.identity vs browser.identity
    identity: {
      getRedirectURL: function(path) {
        if (isFirefox) {
          return browser.identity.getRedirectURL(path);
        } else {
          return chrome.identity.getRedirectURL(path);
        }
      }
    },

    // Notifications API - handles chrome.notifications vs browser.notifications
    notifications: {
      create: function(notificationId, options) {
        if (isFirefox) {
          return browser.notifications.create(notificationId, options);
        } else {
          return new Promise((resolve, reject) => {
            chrome.notifications.create(notificationId, options, (id) => {
              if (chrome.runtime.lastError) {
                reject(chrome.runtime.lastError);
              } else {
                resolve(id);
              }
            });
          });
        }
      },

      clear: function(notificationId) {
        if (isFirefox) {
          return browser.notifications.clear(notificationId);
        } else {
          return new Promise((resolve, reject) => {
            chrome.notifications.clear(notificationId, (wasCleared) => {
              if (chrome.runtime.lastError) {
                reject(chrome.runtime.lastError);
              } else {
                resolve(wasCleared);
              }
            });
          });
        }
      },

      onClicked: {
        addListener: function(callback) {
          if (isFirefox) {
            browser.notifications.onClicked.addListener(callback);
          } else {
            chrome.notifications.onClicked.addListener(callback);
          }
        }
      }
    },

    // Scripting API - handles chrome.scripting (MV3) vs browser.scripting (Firefox)
    scripting: {
      executeScript: function(injection) {
        if (isFirefox) {
          // Firefox uses browser.scripting in MV3
          if (browser.scripting) {
            return browser.scripting.executeScript(injection);
          }
          // Fallback for older Firefox versions
          return Promise.reject(new Error('scripting API not supported'));
        } else {
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
    }
  };

  // Export to global scope using the same pattern as Chrome extension
  if (typeof window !== 'undefined') {
    window.browserAPI = browserAPI;
  }

  // Also make it available as a module export if needed
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = browserAPI;
  }
})();
