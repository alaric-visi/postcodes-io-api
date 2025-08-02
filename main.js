(function () {
  const API_BASE = 'https://api.postcodes.io';

  // Utility: escape HTML special characters to prevent XSS
  function escapeHTML(str) {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  /**
   * Recursively converts a JavaScript object or value into nested UL/LI
   * elements represented as an HTML string. Arrays are handled by
   * creating a UL of their items; objects produce a UL of key/value
   * pairs. Primitive values are escaped and rendered directly.
   *
   * @param {any} obj The value to render
   * @returns {string} HTML string representation
   */
  function generateHTML(obj) {
    if (obj === null || obj === undefined) {
      return '<span class="null">null</span>';
    }
    if (typeof obj !== 'object') {
      return escapeHTML(String(obj));
    }
    if (Array.isArray(obj)) {
      const items = obj
        .map((item) => `<li>${generateHTML(item)}</li>`) // Recursively handle items
        .join('');
      return `<ul>${items}</ul>`;
    }
    // Object
    const rows = Object.entries(obj)
      .map(
        ([key, value]) =>
          `<li><strong>${escapeHTML(key)}:</strong> ${generateHTML(value)}</li>`
      )
      .join('');
    return `<ul>${rows}</ul>`;
  }

  /**
   * Clear all existing result cards from the DOM
   */
  function clearResults() {
    const container = document.getElementById('results');
    container.innerHTML = '';
  }

  /**
   * Render a result card and append it to the results container.
   *
   * @param {string} title A heading for the card
   * @param {any} data The JSON data to display
   */
  function renderCard(title, data) {
    const container = document.getElementById('results');
    const card = document.createElement('div');
    card.className = 'result-card';
    const h3 = document.createElement('h3');
    h3.textContent = title;
    card.appendChild(h3);
    const content = document.createElement('div');
    content.innerHTML = generateHTML(data);
    card.appendChild(content);
    container.appendChild(card);
  }

  /**
   * Render an error message as a result card
   *
   * @param {string} message Error message
   */
  function renderError(message) {
    renderCard('Error', { message });
  }

  /**
   * Perform a GET request and return the parsed JSON. Throws an
   * exception on network failure or non-JSON responses.
   *
   * @param {string} url The full URL to request
   */
  async function getJSON(url) {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`${response.status} ${response.statusText}`);
    }
    return await response.json();
  }

  /**
   * Perform a POST request with JSON payload and return the parsed
   * JSON response. Throws on network failure.
   *
   * @param {string} url The full URL to POST to
   * @param {object} body The payload to send
   */
  async function postJSON(url, body) {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });
    if (!response.ok) {
      throw new Error(`${response.status} ${response.statusText}`);
    }
    return await response.json();
  }

  /**
   * Attach event listeners once the DOM is loaded
   */
  function init() {
    // Postcode lookup
    document.getElementById('lookupPostcodeBtn').addEventListener('click', async () => {
      const postcode = document.getElementById('postcodeInput').value.trim();
      if (!postcode) return;
      clearResults();
      try {
        const data = await getJSON(`${API_BASE}/postcodes/${encodeURIComponent(postcode)}`);
        if (data.status === 200) {
          renderCard(`Postcode: ${postcode.toUpperCase()}`, data.result);
        } else {
          renderError(data.error || `No data found for ${postcode}`);
        }
      } catch (err) {
        renderError(err.message);
      }
    });

    // Postcode validation
    document.getElementById('validatePostcodeBtn').addEventListener('click', async () => {
      const postcode = document.getElementById('postcodeInput').value.trim();
      if (!postcode) return;
      clearResults();
      try {
        const data = await getJSON(`${API_BASE}/postcodes/${encodeURIComponent(postcode)}/validate`);
        // API returns { status:200, result: true/false }
        if (typeof data.result === 'boolean') {
          renderCard(`Validate Postcode: ${postcode.toUpperCase()}`, {
            postcode: postcode.toUpperCase(),
            valid: data.result
          });
        } else {
          renderError('Unexpected validation response');
        }
      } catch (err) {
        renderError(err.message);
      }
    });

    // Postcode query/search
    document.getElementById('queryPostcodeBtn').addEventListener('click', async () => {
      const query = document.getElementById('postcodeInput').value.trim();
      if (!query) return;
      clearResults();
      try {
        const url = new URL(`${API_BASE}/postcodes`);
        url.searchParams.set('q', query);
        url.searchParams.set('limit', '20');
        const data = await getJSON(url.toString());
        if (data.status === 200 && Array.isArray(data.result) && data.result.length) {
          data.result.forEach((item, idx) => {
            renderCard(`Match ${idx + 1}: ${item.postcode}`, item);
          });
        } else {
          renderError(`No matches found for query '${query}'.`);
        }
      } catch (err) {
        renderError(err.message);
      }
    });

    // Bulk postcode lookup
    document.getElementById('bulkLookupBtn').addEventListener('click', async () => {
      const textarea = document.getElementById('bulkPostcodes');
      const lines = textarea.value.split(/\n|,/).map((s) => s.trim()).filter(Boolean);
      if (!lines.length) return;
      if (lines.length > 100) {
        renderError('Bulk lookup is limited to 100 postcodes.');
        return;
      }
      clearResults();
      try {
        const data = await postJSON(`${API_BASE}/postcodes`, { postcodes: lines });
        if (data.status === 200 && Array.isArray(data.result)) {
          data.result.forEach((item, idx) => {
            const title = item.query;
            if (item.result) {
              renderCard(`Bulk Result for ${title}`, item.result);
            } else {
              renderCard(`Bulk Result for ${title}`, { error: 'Not found' });
            }
          });
        } else {
          renderError('Unexpected bulk lookup response.');
        }
      } catch (err) {
        renderError(err.message);
      }
    });

    // Random postcode
    document.getElementById('randomPostcodeBtn').addEventListener('click', async () => {
      const outcodeInput = document.getElementById('postcodeInput').value.trim();
      clearResults();
      try {
        const url = new URL(`${API_BASE}/random/postcodes`);
        if (outcodeInput) {
          // When provided, treat input as outcode filter
          url.searchParams.set('outcode', outcodeInput);
        }
        const data = await getJSON(url.toString());
        if (data.status === 200) {
          renderCard('Random Postcode', data.result);
        } else {
          renderError('Failed to retrieve random postcode.');
        }
      } catch (err) {
        renderError(err.message);
      }
    });

    // Autocomplete
    document.getElementById('autocompleteBtn').addEventListener('click', async () => {
      const partial = document.getElementById('postcodeInput').value.trim();
      if (!partial) return;
      clearResults();
      try {
        const url = new URL(`${API_BASE}/postcodes/${encodeURIComponent(partial)}/autocomplete`);
        url.searchParams.set('limit', '20');
        const data = await getJSON(url.toString());
        if (data.status === 200 && Array.isArray(data.result) && data.result.length) {
          renderCard(`Autocomplete for '${partial}'`, data.result);
        } else {
          renderError(`No autocomplete results for '${partial}'.`);
        }
      } catch (err) {
        renderError(err.message);
      }
    });

    // Nearest postcode
    document.getElementById('nearestPostcodeBtn').addEventListener('click', async () => {
      const postcode = document.getElementById('postcodeInput').value.trim();
      if (!postcode) return;
      clearResults();
      try {
        const url = new URL(`${API_BASE}/postcodes/${encodeURIComponent(postcode)}/nearest`);
        url.searchParams.set('limit', '10');
        const data = await getJSON(url.toString());
        if (data.status === 200 && Array.isArray(data.result) && data.result.length) {
          data.result.forEach((item, idx) => {
            renderCard(`Nearest ${idx + 1}: ${item.postcode}`, item);
          });
        } else {
          renderError(`No nearest postcodes found for '${postcode}'.`);
        }
      } catch (err) {
        renderError(err.message);
      }
    });

    // Reverse geocode (postcode)
    document.getElementById('reverseGeocodeBtn').addEventListener('click', async () => {
      const lat = document.getElementById('latitudeInput').value.trim();
      const lon = document.getElementById('longitudeInput').value.trim();
      if (!lat || !lon) return;
      clearResults();
      try {
        const url = new URL(`${API_BASE}/postcodes`);
        url.searchParams.set('lat', lat);
        url.searchParams.set('lon', lon);
        url.searchParams.set('limit', '10');
        url.searchParams.set('radius', '200');
        const data = await getJSON(url.toString());
        if (data.status === 200 && Array.isArray(data.result) && data.result.length) {
          data.result.forEach((item, idx) => {
            renderCard(`Reverse Geocode ${idx + 1}: ${item.postcode}`, item);
          });
        } else {
          renderError('No postcodes found for the provided coordinates.');
        }
      } catch (err) {
        renderError(err.message);
      }
    });

    // Bulk reverse geocode
    document.getElementById('bulkReverseBtn').addEventListener('click', async () => {
      const input = document.getElementById('bulkGeo').value.trim();
      if (!input) return;
      let geolocations;
      try {
        geolocations = JSON.parse(input);
        if (!Array.isArray(geolocations)) throw new Error('Input must be a JSON array');
      } catch (err) {
        renderError('Invalid JSON for bulk reverse geocode.');
        return;
      }
      clearResults();
      try {
        const data = await postJSON(`${API_BASE}/postcodes`, { geolocations });
        if (data.status === 200 && Array.isArray(data.result)) {
          data.result.forEach((item, idx) => {
            const queryCoords = item.query;
            const heading = `Bulk Reverse Result ${idx + 1}`;
            renderCard(heading, item.result);
          });
        } else {
          renderError('Unexpected bulk reverse geocode response.');
        }
      } catch (err) {
        renderError(err.message);
      }
    });

    // Reverse geocode outcode
    document.getElementById('reverseOutcodeBtn').addEventListener('click', async () => {
      const lat = document.getElementById('latitudeInput').value.trim();
      const lon = document.getElementById('longitudeInput').value.trim();
      if (!lat || !lon) return;
      clearResults();
      try {
        const url = new URL(`${API_BASE}/outcodes`);
        url.searchParams.set('lat', lat);
        url.searchParams.set('lon', lon);
        url.searchParams.set('limit', '10');
        url.searchParams.set('radius', '5000');
        const data = await getJSON(url.toString());
        if (data.status === 200 && Array.isArray(data.result) && data.result.length) {
          data.result.forEach((item, idx) => {
            renderCard(`Reverse Outcode ${idx + 1}: ${item.outcode}`, item);
          });
        } else {
          renderError('No outcodes found for the provided coordinates.');
        }
      } catch (err) {
        renderError(err.message);
      }
    });

    // Outcode lookup
    document.getElementById('lookupOutcodeBtn').addEventListener('click', async () => {
      const outcode = document.getElementById('outcodeInput').value.trim();
      if (!outcode) return;
      clearResults();
      try {
        const data = await getJSON(`${API_BASE}/outcodes/${encodeURIComponent(outcode)}`);
        if (data.status === 200) {
          renderCard(`Outcode: ${outcode.toUpperCase()}`, data.result);
        } else {
          renderError(data.error || `No data found for outcode '${outcode}'.`);
        }
      } catch (err) {
        renderError(err.message);
      }
    });

    // Nearest outcodes
    document.getElementById('nearestOutcodeBtn').addEventListener('click', async () => {
      const outcode = document.getElementById('outcodeInput').value.trim();
      if (!outcode) return;
      clearResults();
      try {
        const url = new URL(`${API_BASE}/outcodes/${encodeURIComponent(outcode)}/nearest`);
        url.searchParams.set('limit', '10');
        const data = await getJSON(url.toString());
        if (data.status === 200 && Array.isArray(data.result) && data.result.length) {
          data.result.forEach((item, idx) => {
            renderCard(`Nearest Outcode ${idx + 1}: ${item.outcode}`, item);
          });
        } else {
          renderError(`No nearest outcodes found for '${outcode}'.`);
        }
      } catch (err) {
        renderError(err.message);
      }
    });

    // Place lookup
    document.getElementById('lookupPlaceBtn').addEventListener('click', async () => {
      const code = document.getElementById('placeCodeInput').value.trim();
      if (!code) return;
      clearResults();
      try {
        const data = await getJSON(`${API_BASE}/places/${encodeURIComponent(code)}`);
        if (data.status === 200) {
          renderCard(`Place Code: ${code}`, data.result);
        } else {
          renderError(data.error || `No place found for code '${code}'.`);
        }
      } catch (err) {
        renderError(err.message);
      }
    });

    // Place query
    document.getElementById('queryPlaceBtn').addEventListener('click', async () => {
      const query = document.getElementById('placeQueryInput').value.trim();
      if (!query) return;
      clearResults();
      try {
        const url = new URL(`${API_BASE}/places`);
        url.searchParams.set('q', query);
        url.searchParams.set('limit', '20');
        const data = await getJSON(url.toString());
        if (data.status === 200 && Array.isArray(data.result) && data.result.length) {
          data.result.forEach((item, idx) => {
            // Each place result may not include all schema fields; render as is
            const heading = item.place_name ? item.place_name : `Place ${idx + 1}`;
            renderCard(heading, item);
          });
        } else {
          renderError(`No places found matching '${query}'.`);
        }
      } catch (err) {
        renderError(err.message);
      }
    });

    // Random place
    document.getElementById('randomPlaceBtn').addEventListener('click', async () => {
      clearResults();
      try {
        const data = await getJSON(`${API_BASE}/random/places`);
        if (data.status === 200) {
          renderCard('Random Place', data.result);
        } else {
          renderError('Failed to retrieve random place.');
        }
      } catch (err) {
        renderError(err.message);
      }
    });

    // Terminated postcode lookup
    document.getElementById('terminatedLookupBtn').addEventListener('click', async () => {
      const postcode = document.getElementById('terminatedInput').value.trim();
      if (!postcode) return;
      clearResults();
      try {
        const data = await getJSON(`${API_BASE}/terminated_postcodes/${encodeURIComponent(postcode)}`);
        if (data.status === 200) {
          renderCard(`Terminated Postcode: ${postcode.toUpperCase()}`, data.result);
        } else {
          renderError(data.error || `No terminated data for '${postcode}'.`);
        }
      } catch (err) {
        renderError(err.message);
      }
    });

    // Scottish postcode lookup
    document.getElementById('scottishLookupBtn').addEventListener('click', async () => {
      const postcode = document.getElementById('scottishInput').value.trim();
      if (!postcode) return;
      clearResults();
      try {
        const data = await getJSON(`${API_BASE}/scotland/postcodes/${encodeURIComponent(postcode)}`);
        if (data.status === 200) {
          renderCard(`Scottish Postcode: ${postcode.toUpperCase()}`, data.result);
        } else {
          renderError(data.error || `No Scottish data for '${postcode}'.`);
        }
      } catch (err) {
        renderError(err.message);
      }
    });
  }

  // Wait for DOM content to load before binding events
  document.addEventListener('DOMContentLoaded', init);
})();
