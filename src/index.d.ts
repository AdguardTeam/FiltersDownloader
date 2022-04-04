declare module '@adguard/filters-downloader/browser' {
    interface DefinedExpressions {
        adguard?: boolean,
        adguard_ext_chromium?: boolean,
        adguard_ext_firefox?: boolean,
        adguard_ext_edge?: boolean,
        adguard_ext_safari?: boolean,
        adguard_ext_opera?: boolean,
        adguard_ext_android_cb?: boolean
    }

    interface Download {
        (url: string, options: DefinedExpressions): Promise<string[]>;
    }

    const download: Download;
}
