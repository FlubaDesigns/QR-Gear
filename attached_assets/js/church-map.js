// Church Directory Map Integration
import googleMaps from './google-maps.js';
import { db } from './firebase-config.js';
import { collection, query, where, getDocs } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';

class ChurchMapManager {
    constructor() {
        this.churches = [];
        this.filteredChurches = [];
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

        await this.loadChurches();
        this.displayChurchMarkers();

        this.setupGeolocationButton();
        return true;
    }

    showMapUnavailableMessage(elementId) {
        const mapElement = document.getElementById(elementId);
        if (mapElement) {
            mapElement.innerHTML = `
                <div class="map-unavailable">
                    <p><strong>Map Unavailable</strong></p>
                    <p>Google Maps API key is not configured. Churches will display in list view only.</p>
                </div>
            `;
            mapElement.style.cssText = 'display: flex; align-items: center; justify-content: center; background: var(--surface-dark); color: var(--text-primary); padding: 2rem; border-radius: 8px;';
        }
    }

    async loadChurches() {
        try {
            const q = query(
                collection(db, 'churches'),
                where('listing_status', '==', 'active')
            );

            const querySnapshot = await getDocs(q);
            this.churches = [];

            for (const doc of querySnapshot.docs) {
                const church = { id: doc.id, ...doc.data() };
                
                if (church.address_line1 && church.city && church.state) {
                    const fullAddress = `${church.address_line1}, ${church.city}, ${church.state} ${church.zip_code || ''}`;
                    
                    try {
                        const geocoded = await googleMaps.geocodeAddress(fullAddress);
                        church.lat = geocoded.lat;
                        church.lng = geocoded.lng;
                        this.churches.push(church);
                    } catch (error) {
                        console.warn(`Failed to geocode ${church.church_name}:`, error);
                        this.churches.push(church);
                    }
                }
            }

            this.filteredChurches = [...this.churches];
        } catch (error) {
            console.error('Error loading churches:', error);
        }
    }

    displayChurchMarkers() {
        googleMaps.clearMarkers();

        this.filteredChurches.forEach(church => {
            if (church.lat && church.lng) {
                const infoContent = this.createInfoWindowContent(church);
                googleMaps.addMarker(
                    { lat: church.lat, lng: church.lng },
                    church.church_name,
                    infoContent
                );
            }
        });

        if (googleMaps.markers.length > 0) {
            googleMaps.fitBoundsToMarkers();
        }
    }

    createInfoWindowContent(church) {
        const denomination = church.denomination || 'Christian Church';
        const parishioners = church.parishioner_count 
            ? `<p>👥 ${church.parishioner_count} members</p>`
            : '';

        return `
            <div class="map-info-window">
                <h3>${church.church_name}</h3>
                <p class="denomination">${denomination}</p>
                ${parishioners}
                <p>${church.address_line1}<br>${church.city}, ${church.state} ${church.zip_code || ''}</p>
                ${church.contact_phone ? `<p>📞 ${church.contact_phone}</p>` : ''}
                ${church.sunday_service ? `<p>⛪ Sunday: ${church.sunday_service}</p>` : ''}
                <a href="/church-detail.html?id=${church.id}" class="btn btn-primary btn-sm">View Details</a>
            </div>
        `;
    }

    setupGeolocationButton() {
        const geoBtn = document.getElementById('find-churches-near-me-btn');
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
            this.displayChurchMarkers();

            if (statusEl) {
                statusEl.textContent = `Found ${this.filteredChurches.length} churches near you`;
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

        this.filteredChurches = this.churches
            .filter(c => c.lat && c.lng)
            .map(church => {
                church.distance = googleMaps.calculateDistance(
                    this.userLocation.lat,
                    this.userLocation.lng,
                    church.lat,
                    church.lng
                );
                return church;
            })
            .sort((a, b) => a.distance - b.distance);
    }

    filterByDenomination(denomination) {
        if (!denomination || denomination === 'all') {
            this.filteredChurches = [...this.churches];
        } else {
            this.filteredChurches = this.churches.filter(
                c => c.denomination === denomination
            );
        }

        if (this.userLocation) {
            this.sortByDistance();
        }

        this.displayChurchMarkers();
    }

    filterByRadius(miles) {
        if (!this.userLocation) {
            alert('Please click "Find Churches Near Me" first');
            return;
        }

        this.filteredChurches = this.churches.filter(church => {
            if (!church.lat || !church.lng) return false;
            
            const distance = googleMaps.calculateDistance(
                this.userLocation.lat,
                this.userLocation.lng,
                church.lat,
                church.lng
            );
            
            return distance <= miles;
        });

        this.displayChurchMarkers();
    }
}

window.churchMapManager = new ChurchMapManager();

export default ChurchMapManager;
