const CACHE_NAME = 'turf-booking-v1.0.2'; // Increment this version
const urlsToCache = [
    '/',
    '/index.html',
    '/admin.html',
    '/manifest.json',
    '/turf.jpg',
    // Add your CSS files if they're separate
    'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2'
];

// Message handling for skipWaiting
self.addEventListener('message', event => {
    if (event.data && event.data.action === 'skipWaiting') {
        self.skipWaiting();
    }
});

// Install Service Worker
self.addEventListener('install', event => {
    console.log('Service Worker installing...');
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('Opened cache');
                return cache.addAll(urlsToCache);
            })
            .catch(error => {
                console.log('Cache failed:', error);
            })
    );
    self.skipWaiting();
});

// SINGLE FETCH EVENT LISTENER - Network-first for HTML, Cache-first for others
self.addEventListener('fetch', event => {
    const url = new URL(event.request.url);
    
    // Network-first for HTML files (gets updates immediately)
    if (event.request.destination === 'document' || url.pathname.endsWith('.html')) {
        event.respondWith(
            fetch(event.request, {
                cache: 'no-store' // Force bypass cache for HTML
            })
                .then(response => {
                    // Update cache with new version
                    if (response && response.status === 200) {
                        const responseClone = response.clone();
                        caches.open(CACHE_NAME)
                            .then(cache => cache.put(event.request, responseClone));
                    }
                    return response;
                })
                .catch(() => {
                    // Fallback to cache only if network fails
                    console.log('Network failed, using cache');
                    return caches.match(event.request) || caches.match('/index.html');
                })
        );
    } else {
        // Cache-first for everything else (CSS, JS, images, API calls)
        event.respondWith(
            caches.match(event.request)
                .then(response => {
                    if (response) {
                        return response; // Return cached version
                    }
                    
                    // Clone the request because it's a stream
                    const fetchRequest = event.request.clone();
                    
                    return fetch(fetchRequest).then(response => {
                        // Check if valid response
                        if (!response || response.status !== 200 || response.type !== 'basic') {
                            return response;
                        }
                        
                        // Clone response because it's a stream
                        const responseToCache = response.clone();
                        
                        caches.open(CACHE_NAME)
                            .then(cache => {
                                cache.put(event.request, responseToCache);
                            });
                        
                        return response;
                    }).catch(() => {
                        // Return offline page or cached content for non-HTML
                        return caches.match(event.request);
                    });
                })
        );
    }
});

// Activate Service Worker
self.addEventListener('activate', event => {
    console.log('Service Worker activating...');
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
    self.clients.claim();
});

// Background sync for offline bookings
self.addEventListener('sync', event => {
    if (event.tag === 'background-sync') {
        event.waitUntil(doBackgroundSync());
    }
});

function doBackgroundSync() {
    // Handle offline bookings when back online
    console.log('Background sync triggered');
}

// Push notifications
self.addEventListener('push', event => {
    const options = {
        body: event.data ? event.data.text() : 'New booking update!',
        icon: '/icons/icon-192x192.png',
        badge: '/icons/icon-72x72.png',
        vibrate: [200, 100, 200],
        data: {
            dateOfArrival: Date.now(),
            primaryKey: 1
        },
        actions: [
            {
                action: 'explore',
                title: 'Open App',
                icon: '/icons/icon-192x192.png'
            },
            {
                action: 'close',
                title: 'Close',
                icon: '/icons/icon-192x192.png'
            }
        ]
    };
    
    event.waitUntil(
        self.registration.showNotification('Turf Booking', options)
    );
});

// Handle notification clicks
self.addEventListener('notificationclick', event => {
    event.notification.close();
    
    if (event.action === 'explore') {
        event.waitUntil(
            clients.openWindow('/')
        );
    }
});
