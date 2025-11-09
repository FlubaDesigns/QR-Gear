// Google Maps Integration for Kingdom Connects
// Handles geolocation, map display, and address validation

class GoogleMapsService {
    constructor() {
        this.apiKey = null;
        this.map = null;
        this.markers = [];
        this.geocoder = null;
        this.infoWindow = null;
    }

    async init() {
        this.apiKey = await this.getApiKey();
        if (!this.apiKey) {
            console.warn('Google Maps API key not configured');
            return false;
        }

        if (!window.google) {
            await this.loadGoogleMapsScript();
        }

        this.geocoder = new google.maps.Geocoder();
        this.infoWindow = new google.maps.InfoWindow();
        return true;
    }

    async getApiKey() {
        try {
            const response = await fetch('/__replit_secrets/GOOGLE_MAPS_API_KEY');
            if (response.ok) {
                return await response.text();
            }
        } catch (error) {
            console.warn('Google Maps API key not found in secrets');
        }
        return null;
    }

    loadGoogleMapsScript() {
        return new Promise((resolve, reject) => {
            if (window.google) {
                resolve();
                return;
            }

            const script = document.createElement('script');
            script.src = `https://maps.googleapis.com/maps/api/js?key=${this.apiKey}&libraries=places`;
            script.async = true;
            script.defer = true;
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }

    createMap(elementId, options = {}) {
        const defaultOptions = {
            zoom: 12,
            center: { lat: 28.5383, lng: -81.3792 }, // Orlando, FL default
            mapTypeControl: true,
            streetViewControl: false,
            fullscreenControl: true,
        };

        const mapElement = document.getElementById(elementId);
        if (!mapElement) {
            console.error(`Map element #${elementId} not found`);
            return null;
        }

        this.map = new google.maps.Map(mapElement, { ...defaultOptions, ...options });
        return this.map;
    }

    addMarker(position, title, infoContent) {
        const marker = new google.maps.Marker({
            position,
            map: this.map,
            title,
            animation: google.maps.Animation.DROP,
        });

        if (infoContent) {
            marker.addListener('click', () => {
                this.infoWindow.setContent(infoContent);
                this.infoWindow.open(this.map, marker);
            });
        }

        this.markers.push(marker);
        return marker;
    }

    clearMarkers() {
        this.markers.forEach(marker => marker.setMap(null));
        this.markers = [];
    }

    async geocodeAddress(address) {
        if (!this.geocoder) {
            await this.init();
        }

        return new Promise((resolve, reject) => {
            this.geocoder.geocode({ address }, (results, status) => {
                if (status === 'OK') {
                    resolve({
                        lat: results[0].geometry.location.lat(),
                        lng: results[0].geometry.location.lng(),
                        formattedAddress: results[0].formatted_address,
                        placeId: results[0].place_id,
                    });
                } else {
                    reject(new Error(`Geocoding failed: ${status}`));
                }
            });
        });
    }

    async reverseGeocode(lat, lng) {
        if (!this.geocoder) {
            await this.init();
        }

        return new Promise((resolve, reject) => {
            const latlng = { lat, lng };
            this.geocoder.geocode({ location: latlng }, (results, status) => {
                if (status === 'OK' && results[0]) {
                    resolve({
                        formattedAddress: results[0].formatted_address,
                        addressComponents: results[0].address_components,
                    });
                } else {
                    reject(new Error(`Reverse geocoding failed: ${status}`));
                }
            });
        });
    }

    getUserLocation() {
        return new Promise((resolve, reject) => {
            if (!navigator.geolocation) {
                reject(new Error('Geolocation is not supported by your browser'));
                return;
            }

            navigator.geolocation.getCurrentPosition(
                (position) => {
                    resolve({
                        lat: position.coords.latitude,
                        lng: position.coords.longitude,
                        accuracy: position.coords.accuracy,
                    });
                },
                (error) => {
                    reject(new Error(`Geolocation error: ${error.message}`));
                }
            );
        });
    }

    centerOnUser() {
        return this.getUserLocation().then(location => {
            if (this.map) {
                this.map.setCenter({ lat: location.lat, lng: location.lng });
                this.map.setZoom(14);

                this.addMarker(
                    { lat: location.lat, lng: location.lng },
                    'Your Location',
                    '<div class="map-info-window"><strong>You are here</strong></div>'
                );
            }
            return location;
        });
    }

    calculateDistance(lat1, lng1, lat2, lng2) {
        const R = 3959; // Earth's radius in miles
        const dLat = this.toRad(lat2 - lat1);
        const dLng = this.toRad(lng2 - lng1);
        const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(this.toRad(lat1)) *
            Math.cos(this.toRad(lat2)) *
            Math.sin(dLng / 2) *
            Math.sin(dLng / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }

    toRad(degrees) {
        return degrees * (Math.PI / 180);
    }

    async validateAddress(address) {
        try {
            const result = await this.geocodeAddress(address);
            return {
                valid: true,
                coordinates: { lat: result.lat, lng: result.lng },
                formattedAddress: result.formattedAddress,
            };
        } catch (error) {
            return {
                valid: false,
                error: error.message,
            };
        }
    }

    fitBoundsToMarkers() {
        if (this.markers.length === 0) return;

        const bounds = new google.maps.LatLngBounds();
        this.markers.forEach(marker => {
            bounds.extend(marker.getPosition());
        });
        this.map.fitBounds(bounds);
    }
}

const googleMaps = new GoogleMapsService();

export default googleMaps;
