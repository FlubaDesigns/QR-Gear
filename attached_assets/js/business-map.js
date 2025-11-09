// Business Directory Map Integration
import googleMaps from './google-maps.js';
import { db } from './firebase-config.js';
import { collection, query, where, getDocs } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';

class BusinessMapManager {
    constructor() {
        this.businesses = [];
        this.filteredBusinesses = [];
        this.userLocation = null;
    }

    async init(mapElementId) {
        const initialized = await googleMaps.init();
        if (!initialized) {
            this.showMapUnavailableMessage(mapElementId);
            return false;
        }

        googleMaps.createMap(mapElementId, {
            zoom: 10,
            center: { lat: 28.5383, lng: -81.3792 }, // Orlando, FL default
        });

        await this.loadBusinesses();
        this.displayBusinessMarkers();

        this.setupGeolocationButton();
        return true;
    }

    showMapUnavailableMessage(elementId) {
        const mapElement = document.getElementById(elementId);
        if (mapElement) {
            mapElement.innerHTML = `
                <div class="map-unavailable">
                    <p><strong>Map Unavailable</strong></p>
                    <p>Google Maps API key is not configured. Businesses will display in list view only.</p>
                </div>
            `;
            mapElement.style.cssText = 'display: flex; align-items: center; justify-content: center; background: var(--surface-dark); color: var(--text-primary); padding: 2rem; border-radius: 8px;';
        }
    }

    async loadBusinesses() {
        try {
            const q = query(
                collection(db, 'business_listings'),
                where('listing_status', '==', 'active')
            );

            const querySnapshot = await getDocs(q);
            this.businesses = [];

            for (const doc of querySnapshot.docs) {
                const business = { id: doc.id, ...doc.data() };
                
                if (business.address_line1 && business.city && business.state) {
                    const fullAddress = `${business.address_line1}, ${business.city}, ${business.state} ${business.zip_code || ''}`;
                    
                    try {
                        const geocoded = await googleMaps.geocodeAddress(fullAddress);
                        business.lat = geocoded.lat;
                        business.lng = geocoded.lng;
                        this.businesses.push(business);
                    } catch (error) {
                        console.warn(`Failed to geocode ${business.business_name}:`, error);
                        this.businesses.push(business);
                    }
                }
            }

            this.filteredBusinesses = [...this.businesses];
        } catch (error) {
            console.error('Error loading businesses:', error);
        }
    }

    displayBusinessMarkers() {
        googleMaps.clearMarkers();

        this.filteredBusinesses.forEach(business => {
            if (business.lat && business.lng) {
                const infoContent = this.createInfoWindowContent(business);
                googleMaps.addMarker(
                    { lat: business.lat, lng: business.lng },
                    business.business_name,
                    infoContent
                );
            }
        });

        if (googleMaps.markers.length > 0) {
            googleMaps.fitBoundsToMarkers();
        }
    }

    createInfoWindowContent(business) {
        const proIcon = business.pro_status ? '<span class="badge badge-gold">PRO</span>' : '';
        const rating = business.average_rating 
            ? `<div class="rating">⭐ ${business.average_rating.toFixed(1)}</div>`
            : '';

        return `
            <div class="map-info-window">
                <h3>${business.business_name} ${proIcon}</h3>
                <p class="category">${business.primary_category || 'Business'}</p>
                ${rating}
                <p>${business.address_line1}<br>${business.city}, ${business.state} ${business.zip_code || ''}</p>
                ${business.phone ? `<p>📞 ${business.phone}</p>` : ''}
                <a href="/business-detail.html?id=${business.id}" class="btn btn-primary btn-sm">View Details</a>
            </div>
        `;
    }

    setupGeolocationButton() {
        const geoBtn = document.getElementById('find-near-me-btn');
        if (geoBtn) {
            geoBtn.addEventListener('click', () => this.findNearMe());
        }
    }

    async findNearMe() {
        try {
            const statusEl = document.getElementById('geolocation-status');
            if (statusEl) {
                statusEl.textContent = 'Finding your location...';
                statusEl.className = 'status-info';
            }

            this.userLocation = await googleMaps.centerOnUser();

            this.sortByDistance();
            this.displayBusinessMarkers();

            if (statusEl) {
                statusEl.textContent = `Found ${this.filteredBusinesses.length} businesses near you`;
                statusEl.className = 'status-success';
            }
        } catch (error) {
            console.error('Geolocation error:', error);
            const statusEl = document.getElementById('geolocation-status');
            if (statusEl) {
                statusEl.textContent = 'Unable to get your location. Please enable location services.';
                statusEl.className = 'status-error';
            }
        }
    }

    sortByDistance() {
        if (!this.userLocation) return;

        this.filteredBusinesses = this.businesses
            .filter(b => b.lat && b.lng)
            .map(business => {
                business.distance = googleMaps.calculateDistance(
                    this.userLocation.lat,
                    this.userLocation.lng,
                    business.lat,
                    business.lng
                );
                return business;
            })
            .sort((a, b) => a.distance - b.distance);
    }

    filterByCategory(category) {
        if (!category || category === 'all') {
            this.filteredBusinesses = [...this.businesses];
        } else {
            this.filteredBusinesses = this.businesses.filter(
                b => b.primary_category === category || 
                     (b.secondary_categories && b.secondary_categories.includes(category))
            );
        }

        if (this.userLocation) {
            this.sortByDistance();
        }

        this.displayBusinessMarkers();
    }

    filterByRadius(miles) {
        if (!this.userLocation) {
            alert('Please click "Find Businesses Near Me" first');
            return;
        }

        this.filteredBusinesses = this.businesses.filter(business => {
            if (!business.lat || !business.lng) return false;
            
            const distance = googleMaps.calculateDistance(
                this.userLocation.lat,
                this.userLocation.lng,
                business.lat,
                business.lng
            );
            
            return distance <= miles;
        });

        this.displayBusinessMarkers();
    }
}

window.businessMapManager = new BusinessMapManager();

export default BusinessMapManager;
