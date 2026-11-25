
export interface GeoCoordinate {
    latitude: number;
    longitude: number;
}

export interface JanusProbeRequest {
    latitude: number;
    longitude: number;
    radius_m: number;
    label?: string;
    crop_type?: string;
    sensor_overrides?: Record<string, unknown>;
    query_live_stac: boolean;
    run_enrichment: boolean;
}

export interface JanusHealthResponse {
    status?: string;
    service?: string;
    enricher_loaded?: boolean;
    [key: string]: unknown;
}

export type JanusProbeResponse = Record<string, unknown>;

const API_BASE_URL = 'http://127.0.0.1:8765';

async function request<T>(
    path: string,
    options: RequestInit = {},
): Promise<T> {
    let response: Response;

    try {
        response = await fetch(`${API_BASE_URL}${path}`, {
            ...options,
            headers: {
                Accept: 'application/json',
                ...(options.body ? { 'Content-Type': 'application/json' } : {}),
                ...options.headers,
            },
        });
    } catch (error) {
        throw new Error(
            `Cannot connect to JANUS at ${API_BASE_URL}. ` +
            'Check that the Python Geo Probe service is running.',
            { cause: error },
        );
    }

    const body = await response.text();
    let data: unknown;

    try {
        data = body ? JSON.parse(body) : {};
    } catch {
        throw new Error(
            `JANUS returned an invalid response (HTTP ${response.status}).`,
        );
    }

    if (!response.ok) {
        const message =
            typeof data === 'object' &&
            data !== null &&
            'error' in data &&
            typeof data.error === 'string'
                ? data.error
                : `JANUS request failed with HTTP ${response.status}.`;

        throw new Error(message);
    }

    return data as T;
}

export const JanusGeoProbeService = {
    health(): Promise<JanusHealthResponse> {
        return request<JanusHealthResponse>('/health');
    },

    probe(payload: JanusProbeRequest): Promise<JanusProbeResponse> {
        return request<JanusProbeResponse>('/api/probe', {
            method: 'POST',
            body: JSON.stringify(payload),
        });
    },
};

export default JanusGeoProbeService;
