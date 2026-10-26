package com.viromedia.bridge.module;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertNull;
import static org.junit.Assert.assertTrue;
import static org.junit.Assert.fail;

import org.junit.Test;

public class StudioSessionRulesTest {

    @Test
    public void acceptsHttpsAndStripsTrailingSlashes() {
        assertEquals("https://project.supabase.co",
                StudioSessionRules.baseUrl("https://project.supabase.co"));
        assertEquals("https://platform.reactvision.xyz/api",
                StudioSessionRules.baseUrl("https://platform.reactvision.xyz/api//"));
        assertEquals("https://example.com:8443",
                StudioSessionRules.baseUrl("https://example.com:8443/"));
    }

    @Test
    public void acceptsHttpOnlyForDevHosts() {
        assertEquals("http://localhost:54321", StudioSessionRules.baseUrl("http://localhost:54321"));
        assertEquals("http://10.0.2.2:54321", StudioSessionRules.baseUrl("http://10.0.2.2:54321/"));
        assertEquals("http://127.0.0.1", StudioSessionRules.baseUrl("http://127.0.0.1"));
        assertEquals("http://LOCALHOST:3000", StudioSessionRules.baseUrl("http://LOCALHOST:3000"));
    }

    @Test
    public void rejectsCleartextToOtherHosts() {
        expectBaseUrlRejected("http://project.supabase.co", "https");
        expectBaseUrlRejected("http://192.168.1.20:54321", "https");
        // A dev host name as a subdomain prefix is still a remote host.
        expectBaseUrlRejected("http://localhost.evil.com", "https");
    }

    @Test
    public void rejectsOtherSchemesAndMalformedUrls() {
        expectBaseUrlRejected("ftp://example.com", "https");
        expectBaseUrlRejected("file:///etc/passwd", "https");
        expectBaseUrlRejected("example.com", "https");
        expectBaseUrlRejected("https:///functions", "host");
        expectBaseUrlRejected("https://exa mple.com", "valid URL");
    }

    @Test
    public void rejectsUserInfoQueryAndFragment() {
        expectBaseUrlRejected("https://user:pw@example.com", "credentials");
        expectBaseUrlRejected("https://example.com?x=1", "query");
        expectBaseUrlRejected("https://example.com#frag", "fragment");
    }

    @Test
    public void functionRegionAllowsAbsentOrShortLowercaseSlug() {
        assertNull(StudioSessionRules.functionRegion(null));
        // Empty has always meant "not pinned" on both platforms.
        assertNull(StudioSessionRules.functionRegion(""));
        assertEquals("eu-west-2", StudioSessionRules.functionRegion("eu-west-2"));
        assertEquals("us-east-1", StudioSessionRules.functionRegion("us-east-1"));
        assertEquals("a", StudioSessionRules.functionRegion("a"));
        assertEquals("abcdefghijklmnopqrstuvwxyz012345",
                StudioSessionRules.functionRegion("abcdefghijklmnopqrstuvwxyz012345"));
    }

    @Test
    public void functionRegionRejectsAnythingElse() {
        expectRegionRejected("EU-WEST-2");
        expectRegionRejected("eu_west_2");
        expectRegionRejected("eu-west-2\r\nx-api-key: stolen");
        expectRegionRejected("abcdefghijklmnopqrstuvwxyz0123456");
        expectRegionRejected("eu west");
    }

    private static void expectBaseUrlRejected(String url, String reasonFragment) {
        try {
            StudioSessionRules.baseUrl(url);
            fail("accepted " + url);
        } catch (IllegalArgumentException expected) {
            assertTrue(expected.getMessage(), expected.getMessage().contains(reasonFragment));
        }
    }

    private static void expectRegionRejected(String region) {
        try {
            StudioSessionRules.functionRegion(region);
            fail("accepted " + region);
        } catch (IllegalArgumentException expected) {
            assertTrue(expected.getMessage(), expected.getMessage().contains("functionRegion"));
        }
    }
}
