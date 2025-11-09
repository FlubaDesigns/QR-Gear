// Address Validation for Business and Church Submissions
import googleMaps from './google-maps.js';

class AddressValidator {
    constructor() {
        this.initialized = false;
    }

    async init() {
        if (!this.initialized) {
            this.initialized = await googleMaps.init();
        }
        return this.initialized;
    }

    async validateBusinessAddress(formData) {
        await this.init();

        const address = `${formData.address_line1}, ${formData.city}, ${formData.state} ${formData.zip_code}`;
        
        try {
            const result = await googleMaps.validateAddress(address);
            
            if (result.valid) {
                return {
                    valid: true,
                    coordinates: result.coordinates,
                    formattedAddress: result.formattedAddress,
                    suggestion: this.suggestCorrection(formData, result.formattedAddress),
                };
            } else {
                return {
                    valid: false,
                    error: 'Address could not be verified. Please check and try again.',
                };
            }
        } catch (error) {
            console.warn('Address validation unavailable:', error);
            return {
                valid: true,
                warning: 'Address validation unavailable. Proceeding without verification.',
            };
        }
    }

    suggestCorrection(originalData, formattedAddress) {
        const original = `${originalData.address_line1}, ${originalData.city}, ${originalData.state} ${originalData.zip_code}`;
        
        if (original.toLowerCase() !== formattedAddress.toLowerCase()) {
            return {
                hasCorrection: true,
                original: original,
                suggested: formattedAddress,
                message: 'Google Maps suggests a different format for this address. Would you like to use the suggested format?',
            };
        }
        
        return {
            hasCorrection: false,
        };
    }

    showValidationUI(validationResult, formElement) {
        const existingAlert = formElement.querySelector('.address-validation-alert');
        if (existingAlert) {
            existingAlert.remove();
        }

        if (validationResult.suggestion && validationResult.suggestion.hasCorrection) {
            const alert = document.createElement('div');
            alert.className = 'address-validation-alert alert alert-warning';
            alert.innerHTML = `
                <p><strong>Address Suggestion:</strong></p>
                <p><strong>You entered:</strong> ${validationResult.suggestion.original}</p>
                <p><strong>Google suggests:</strong> ${validationResult.suggestion.suggested}</p>
                <button type="button" class="btn btn-sm btn-primary" id="use-suggested-address">Use Suggested Address</button>
                <button type="button" class="btn btn-sm btn-secondary" id="keep-original-address">Keep My Address</button>
            `;

            const addressField = formElement.querySelector('[name="address_line1"]');
            addressField.parentNode.insertBefore(alert, addressField.nextSibling);

            document.getElementById('use-suggested-address').addEventListener('click', () => {
                this.applySuggestedAddress(formElement, validationResult.suggestion.suggested);
                alert.remove();
            });

            document.getElementById('keep-original-address').addEventListener('click', () => {
                alert.remove();
            });
        }

        if (!validationResult.valid) {
            const alert = document.createElement('div');
            alert.className = 'address-validation-alert alert alert-error';
            alert.innerHTML = `
                <p><strong>Address Validation Failed</strong></p>
                <p>${validationResult.error}</p>
            `;

            const addressField = formElement.querySelector('[name="address_line1"]');
            addressField.parentNode.insertBefore(alert, addressField.nextSibling);
        }
    }

    applySuggestedAddress(formElement, formattedAddress) {
        const parts = this.parseFormattedAddress(formattedAddress);
        
        const fields = {
            address_line1: formElement.querySelector('[name="address_line1"]'),
            city: formElement.querySelector('[name="city"]'),
            state: formElement.querySelector('[name="state"]'),
            zip_code: formElement.querySelector('[name="zip_code"]'),
        };

        if (parts.street && fields.address_line1) {
            fields.address_line1.value = parts.street;
        }
        if (parts.city && fields.city) {
            fields.city.value = parts.city;
        }
        if (parts.state && fields.state) {
            fields.state.value = parts.state;
        }
        if (parts.zip && fields.zip_code) {
            fields.zip_code.value = parts.zip;
        }
    }

    parseFormattedAddress(formattedAddress) {
        const regex = /^(.+?),\s*(.+?),\s*([A-Z]{2})\s*(\d{5}(?:-\d{4})?)?/;
        const match = formattedAddress.match(regex);

        if (match) {
            return {
                street: match[1],
                city: match[2],
                state: match[3],
                zip: match[4] || '',
            };
        }

        return {};
    }

    async geocodeAndStore(formData) {
        await this.init();

        const address = `${formData.address_line1}, ${formData.city}, ${formData.state} ${formData.zip_code}`;
        
        try {
            const geocoded = await googleMaps.geocodeAddress(address);
            return {
                lat: geocoded.lat,
                lng: geocoded.lng,
                place_id: geocoded.placeId,
            };
        } catch (error) {
            console.warn('Geocoding failed:', error);
            return null;
        }
    }
}

const addressValidator = new AddressValidator();

export default addressValidator;
