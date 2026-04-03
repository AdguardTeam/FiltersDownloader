/**
 * HTTP response headers captured from a file download.
 */
export interface FileDownloadHeaders {
    /**
     * The Last-Modified HTTP header value.
     */
    lastModified?: string;
}

/**
 * Result of file download operation including content and optional headers.
 */
export interface FileDownloadResult {
    /**
     * The downloaded file content.
     */
    content: string;

    /**
     * HTTP response headers (only for external downloads).
     */
    headers?: FileDownloadHeaders;
}
