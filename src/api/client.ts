import type { LocalFile } from './types';

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

let baseUrl = '';
let authToken: string | null = null;
let unauthorizedHandler: (() => void) | null = null;
let connectivityHandler: ((online: boolean) => void) | null = null;

export const apiConfig = {
  setBaseUrl(url: string) {
    baseUrl = url.replace(/\/+$/, '');
  },
  getBaseUrl() {
    return baseUrl;
  },
  setToken(token: string | null) {
    authToken = token;
  },
  onUnauthorized(handler: (() => void) | null) {
    unauthorizedHandler = handler;
  },
  onConnectivity(handler: ((online: boolean) => void) | null) {
    connectivityHandler = handler;
  },
};

type Query = Record<string, string | number | boolean | null | undefined>;

function buildUrl(path: string, query?: Query) {
  let url = `${baseUrl}/api/${path.replace(/^\/+/, '')}`;
  if (query) {
    const qs = Object.entries(query)
      .filter(([, v]) => v !== undefined && v !== null && v !== '')
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
      .join('&');
    if (qs) {
      url += `?${qs}`;
    }
  }
  return url;
}

async function parseError(res: Response): Promise<string> {
  try {
    const text = await res.text();
    if (!text) {
      return defaultMessage(res.status);
    }
    const data = JSON.parse(text);
    if (typeof data === 'string') {
      return data;
    }
    if (data?.message) {
      return data.message;
    }
    if (data?.errors) {
      const first = Object.values(data.errors as Record<string, string[]>)[0];
      if (Array.isArray(first) && first.length) {
        return first[0];
      }
    }
    if (Array.isArray(data) && data[0]?.description) {
      return data.map((e: { description: string }) => e.description).join('\n');
    }
    if (data?.title) {
      return data.title;
    }
    if (data?.error) {
      return data.error;
    }
  } catch {
    // ignore parse errors
  }
  return defaultMessage(res.status);
}

function defaultMessage(status: number) {
  if (status === 401) {
    return 'Sessiyanın vaxtı bitib. Yenidən daxil olun.';
  }
  if (status === 403) {
    return 'Bu əməliyyat üçün icazəniz yoxdur.';
  }
  if (status === 404) {
    return 'Məlumat tapılmadı.';
  }
  return `Server xətası (${status}).`;
}

async function send<T>(url: string, init: RequestInit): Promise<T> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...(init.headers as Record<string, string>),
  };
  if (authToken) {
    headers.Authorization = `Bearer ${authToken}`;
  }

  let res: Response;
  try {
    res = await fetch(url, { ...init, headers });
    connectivityHandler?.(true);
  } catch {
    connectivityHandler?.(false);
    throw new ApiError(
      'Serverlə əlaqə yaradıla bilmədi. İnternet bağlantınızı yoxlayın.',
      0,
    );
  }

  if (res.status === 401 && authToken) {
    unauthorizedHandler?.();
  }
  if (!res.ok) {
    throw new ApiError(await parseError(res), res.status);
  }
  if (res.status === 204) {
    return undefined as T;
  }
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

export const http = {
  get<T>(path: string, query?: Query) {
    return send<T>(buildUrl(path, query), { method: 'GET' });
  },
  post<T>(path: string, body?: unknown) {
    return send<T>(buildUrl(path), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  },
  put<T>(path: string, body?: unknown) {
    return send<T>(buildUrl(path), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  },
  delete<T = void>(path: string) {
    return send<T>(buildUrl(path), { method: 'DELETE' });
  },
  /** multipart/form-data upload with a single `file` field (IFormFile file). */
  upload<T>(path: string, file: LocalFile, query?: Query) {
    const form = new FormData();
    form.append('file', {
      uri: file.uri,
      name: file.name,
      type: file.type || 'application/octet-stream',
    } as unknown as Blob);
    return send<T>(buildUrl(path, query), { method: 'POST', body: form });
  },
};

/** Public URL of an uploaded file (FilesController is anonymous). */
export function fileUrl(filePath: string | null | undefined): string | undefined {
  if (!filePath) {
    return undefined;
  }
  if (/^https?:\/\//i.test(filePath) || /^file:\/\//i.test(filePath)) {
    return filePath;
  }
  const clean = filePath.replace(/\\/g, '/').replace(/^\/+/, '');
  return `${baseUrl}/api/files/${clean.split('/').map(encodeURIComponent).join('/')}`;
}

