package com.viromedia.bridge.module;

import java.net.URI;
import java.net.URISyntaxException;
import java.util.Arrays;
import java.util.HashSet;
import java.util.Locale;
import java.util.Set;
import java.util.regex.Pattern;

/**
 * Validates the internal Studio session config before VRTStudioModule stores it. The session
 * carries a bearer token that native sends to {@code baseUrl} on every Studio, cloud-anchor
 * and co-location request, so the URL must be https. Cleartext is allowed only for the hosts
 * a local platform runs on: localhost, 127.0.0.1, and 10.0.2.2 (the Android emulator's alias
 * for the development machine). ios/ViroReact/Modules/VRTStudioModule.mm applies the same
 * rules.
 */
final class StudioSessionRules {
    private static final Set<String> CLEARTEXT_HOSTS =
            new HashSet<>(Arrays.asList("localhost", "127.0.0.1", "10.0.2.2"));
    // Sent as the x-region header, so it must never carry anything but a region slug.
    private static final Pattern FUNCTION_REGION = Pattern.compile("^[a-z0-9-]{1,32}$");

    private StudioSessionRules() {}

    /**
     * @return {@code url} without trailing slashes
     * @throws IllegalArgumentException naming the rule {@code url} breaks
     */
    static String baseUrl(String url) {
        URI uri;
        try {
            uri = new URI(url);
        } catch (URISyntaxException error) {
            throw new IllegalArgumentException("baseUrl is not a valid URL: " + error.getReason());
        }
        String scheme = uri.getScheme() == null ? "" : uri.getScheme().toLowerCase(Locale.ROOT);
        String host = uri.getHost() == null ? null : uri.getHost().toLowerCase(Locale.ROOT);
        if (!scheme.equals("https") && !scheme.equals("http")) {
            throw new IllegalArgumentException("baseUrl must use https");
        }
        if (host == null || host.isEmpty()) {
            throw new IllegalArgumentException("baseUrl has no host");
        }
        if (scheme.equals("http") && !CLEARTEXT_HOSTS.contains(host)) {
            throw new IllegalArgumentException("baseUrl must use https; http is allowed only for "
                    + "localhost, 127.0.0.1 and 10.0.2.2");
        }
        if (uri.getRawUserInfo() != null) {
            throw new IllegalArgumentException("baseUrl must not contain credentials");
        }
        if (uri.getRawQuery() != null) {
            throw new IllegalArgumentException("baseUrl must not have a query");
        }
        if (uri.getRawFragment() != null) {
            throw new IllegalArgumentException("baseUrl must not have a fragment");
        }
        String trimmed = url;
        while (trimmed.endsWith("/")) trimmed = trimmed.substring(0, trimmed.length() - 1);
        return trimmed;
    }

    /**
     * @return {@code region}, or null for "not pinned" when it is null or empty
     * @throws IllegalArgumentException if a non-empty {@code region} is not 1 to 32 of [a-z0-9-]
     */
    static String functionRegion(String region) {
        if (region == null || region.isEmpty()) return null;
        if (!FUNCTION_REGION.matcher(region).matches()) {
            throw new IllegalArgumentException(
                    "functionRegion must match ^[a-z0-9-]{1,32}$");
        }
        return region;
    }
}
