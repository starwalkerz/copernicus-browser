
import React, { useCallback, useEffect, useState } from 'react';
import './JanusGeoProbe.scss';

import JanusGeoProbeService, {
    GeoCoordinate,
    JanusHealthResponse,
    JanusProbeResponse,
    JanusProbeRequest,
} from '../../services/janusGeoProbe/JanusGeoProbeService';

export interface JanusGeoProbeProps {
    selectedCoordinates?: GeoCoordinate | null;
    selectedLocationLabel?: string;
    onClose?: () => void;
}

type ProbeStatus = 'idle' | 'running' | 'success' | 'error';

const DEFAULT_RADIUS = 250;
const MIN_RADIUS = 10;
const MAX_RADIUS = 10000;

const JanusGeoProbe: React.FC<JanusGeoProbeProps> = ({
    selectedCoordinates,
    selectedLocationLabel,
    onClose,
}) => {
    const [latitude, setLatitude] = useState('');
    const [longitude, setLongitude] = useState('');
    const [radius, setRadius] = useState(String(DEFAULT_RADIUS));
    const [label, setLabel] = useState('');
    const [cropType, setCropType] = useState('generic');

    const [queryLiveStac, setQueryLiveStac] = useState(true);
    const [runEnrichment, setRunEnrichment] = useState(false);

    const [status, setStatus] = useState<ProbeStatus>('idle');
    const [result, setResult] = useState<JanusProbeResponse | null>(null);
    const [error, setError] = useState<string | null>(null);

    const [health, setHealth] = useState<JanusHealthResponse | null>(null);
    const [healthError, setHealthError] = useState<string | null>(null);

    // Receive coordinates from the Copernicus Browser map.
    useEffect(() => {
        if (!selectedCoordinates) {
            return;
        }

        setLatitude(String(selectedCoordinates.latitude));
        setLongitude(String(selectedCoordinates.longitude));

        if (selectedLocationLabel) {
            setLabel(selectedLocationLabel);
        }
    }, [
        selectedCoordinates?.latitude,
        selectedCoordinates?.longitude,
        selectedLocationLabel,
    ]);

    // Check whether the local Python service is available.
    const checkHealth = useCallback(async () => {
        try {
            const response = await JanusGeoProbeService.health();
            setHealth(response);
            setHealthError(null);
        } catch (err) {
            setHealth(null);
            setHealthError(
                err instanceof Error ? err.message : 'JANUS is unavailable.',
            );
        }
    }, []);

    useEffect(() => {
        void checkHealth();
    }, [checkHealth]);

    const parsedLatitude = Number(latitude);
    const parsedLongitude = Number(longitude);
    const parsedRadius = Number(radius);

    const coordinatesValid =
        latitude.trim() !== '' &&
        longitude.trim() !== '' &&
        Number.isFinite(parsedLatitude) &&
        Number.isFinite(parsedLongitude) &&
        parsedLatitude >= -90 &&
        parsedLatitude <= 90 &&
        parsedLongitude >= -180 &&
        parsedLongitude <= 180;

    const radiusValid =
        Number.isFinite(parsedRadius) &&
        parsedRadius >= MIN_RADIUS &&
        parsedRadius <= MAX_RADIUS;

    const canRun =
        coordinatesValid &&
        radiusValid &&
        status !== 'running';

    const runProbe = useCallback(async () => {
        if (!canRun) {
            return;
        }

        setStatus('running');
        setError(null);
        setResult(null);

        const payload: JanusProbeRequest = {
            latitude: parsedLatitude,
            longitude: parsedLongitude,
            radius_m: parsedRadius,
            label: label.trim() || undefined,
            crop_type: cropType,
            query_live_stac: queryLiveStac,
            run_enrichment: runEnrichment,
        };

        try {
            const response = await JanusGeoProbeService.probe(payload);
            setResult(response);
            setStatus('success');
        } catch (err) {
            setError(
                err instanceof Error
                    ? err.message
                    : 'The Geo Probe request failed.',
            );
            setStatus('error');
        }
    }, [
        canRun,
        parsedLatitude,
        parsedLongitude,
        parsedRadius,
        label,
        cropType,
        queryLiveStac,
        runEnrichment,
    ]);

    const copyResult = useCallback(async () => {
        if (!result) {
            return;
        }

        try {
            await navigator.clipboard.writeText(
                JSON.stringify(result, null, 2),
            );
        } catch {
            setError('Could not copy the result to the clipboard.');
        }
    }, [result]);

    const downloadResult = useCallback(() => {
        if (!result) {
            return;
        }

        const blob = new Blob(
            [JSON.stringify(result, null, 2)],
            { type: 'application/json' },
        );

        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');

        anchor.href = url;
        anchor.download = `janus-geo-probe-${parsedLatitude}-${parsedLongitude}.json`;
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();

        URL.revokeObjectURL(url);
    }, [result, parsedLatitude, parsedLongitude]);

    return (
        <section className="janus-geo-probe">
            <header className="janus-geo-probe__header">
                <div>
                    <div className="janus-geo-probe__eyebrow">
                        JANUS · EARTH OBSERVATION
                    </div>
                    <h2>Geo Probe</h2>
                    <p>
                        Coordinate-based planetary intelligence
                    </p>
                </div>

                {onClose && (
                    <button
                        type="button"
                        className="janus-geo-probe__close"
                        onClick={onClose}
                        aria-label="Close Geo Probe"
                    >
                        ×
                    </button>
                )}
            </header>

            <div className="janus-geo-probe__connection">
                <span
                    className={`janus-geo-probe__status-dot ${
                        health
                            ? 'janus-geo-probe__status-dot--online'
                            : 'janus-geo-probe__status-dot--offline'
                    }`}
                />

                <span>
                    {health
                        ? 'Python service connected'
                        : 'Python service unavailable'}
                </span>

                <button
                    type="button"
                    className="janus-geo-probe__text-button"
                    onClick={() => void checkHealth()}
                >
                    Check
                </button>
            </div>

            {healthError && (
                <div className="janus-geo-probe__notice janus-geo-probe__notice--warning">
                    {healthError}
                </div>
            )}

            {health && (
                <div className="janus-geo-probe__service-info">
                    Optional enrichment:{' '}
                    <strong>
                        {health.enricher_loaded ? 'available' : 'not configured'}
                    </strong>
                </div>
            )}

            <div className="janus-geo-probe__section">
                <h3>Location</h3>

                {selectedCoordinates && (
                    <div className="janus-geo-probe__map-selection">
                        <span>Map selection received</span>
                        <strong>
                            {selectedCoordinates.latitude.toFixed(6)},{' '}
                            {selectedCoordinates.longitude.toFixed(6)}
                        </strong>
                    </div>
                )}

                <div className="janus-geo-probe__coordinate-grid">
                    <label>
                        Latitude
                        <input
                            type="number"
                            step="any"
                            min="-90"
                            max="90"
                            value={latitude}
                            onChange={(event) => setLatitude(event.target.value)}
                            placeholder="e.g. 60.1699"
                        />
                    </label>

                    <label>
                        Longitude
                        <input
                            type="number"
                            step="any"
                            min="-180"
                            max="180"
                            value={longitude}
                            onChange={(event) => setLongitude(event.target.value)}
                            placeholder="e.g. 24.9384"
                        />
                    </label>
                </div>

                <label className="janus-geo-probe__field">
                    Location label
                    <input
                        type="text"
                        value={label}
                        onChange={(event) => setLabel(event.target.value)}
                        placeholder="Optional location name"
                    />
                </label>
            </div>

            <div className="janus-geo-probe__section">
                <h3>Probe configuration</h3>

                <label className="janus-geo-probe__field">
                    Probe radius (metres)
                    <input
                        type="number"
                        min={MIN_RADIUS}
                        max={MAX_RADIUS}
                        step="10"
                        value={radius}
                        onChange={(event) => setRadius(event.target.value)}
                    />
                    <small>
                        {MIN_RADIUS}–{MAX_RADIUS.toLocaleString()} metres
                    </small>
                </label>

                <label className="janus-geo-probe__field">
                    Crop context
                    <select
                        value={cropType}
                        onChange={(event) => setCropType(event.target.value)}
                    >
                        <option value="generic">Generic / unknown</option>
                        <option value="cacao">Cacao</option>
                        <option value="coffee">Coffee</option>
                        <option value="wheat">Wheat</option>
                        <option value="maize">Maize</option>
                        <option value="rice">Rice</option>
                        <option value="soy">Soy</option>
                    </select>
                </label>

                <label className="janus-geo-probe__toggle">
                    <input
                        type="checkbox"
                        checked={queryLiveStac}
                        onChange={(event) =>
                            setQueryLiveStac(event.target.checked)
                        }
                    />
                    <span>
                        <strong>Query live STAC sources</strong>
                        <small>
                            Request current available satellite observations
                        </small>
                    </span>
                </label>

                <label className="janus-geo-probe__toggle">
                    <input
                        type="checkbox"
                        checked={runEnrichment}
                        onChange={(event) =>
                            setRunEnrichment(event.target.checked)
                        }
                    />
                    <span>
                        <strong>Run optional enrichment</strong>
                        <small>
                            Enable configured Python-side enrichment
                        </small>
                    </span>
                </label>
            </div>

            <button
                type="button"
                className="janus-geo-probe__run"
                onClick={() => void runProbe()}
                disabled={!canRun}
            >
                {status === 'running'
                    ? 'Probing…'
                    : 'Run Geo Probe'}
            </button>

            {!coordinatesValid && (
                <p className="janus-geo-probe__validation">
                    Enter valid WGS84 coordinates to continue.
                </p>
            )}

            {coordinatesValid && !radiusValid && (
                <p className="janus-geo-probe__validation">
                    Radius must be between {MIN_RADIUS} and{' '}
                    {MAX_RADIUS.toLocaleString()} metres.
                </p>
            )}

            {status === 'running' && (
                <div className="janus-geo-probe__loading">
                    <span className="janus-geo-probe__spinner" />
                    Querying the Python Geo Probe…
                </div>
            )}

            {error && (
                <div className="janus-geo-probe__notice janus-geo-probe__notice--error">
                    {error}
                </div>
            )}

            {result && (
                <div className="janus-geo-probe__results">
                    <div className="janus-geo-probe__results-header">
                        <div>
                            <h3>Probe result</h3>
                            <span>Raw response from JANUS</span>
                        </div>

                        <div className="janus-geo-probe__result-actions">
                            <button
                                type="button"
                                onClick={() => void copyResult()}
                            >
                                Copy
                            </button>
                            <button
                                type="button"
                                onClick={downloadResult}
                            >
                                JSON
                            </button>
                        </div>
                    </div>

                    <pre>
                        {JSON.stringify(result, null, 2)}
                    </pre>
                </div>
            )}
        </section>
    );
};

export default JanusGeoProbe;
