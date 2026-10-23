package com.tenderteddy.firetv;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.Context;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.net.ConnectivityManager;
import android.net.NetworkInfo;
import android.os.Bundle;
import android.view.Gravity;
import android.view.KeyEvent;
import android.view.ViewGroup;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.EditText;
import android.widget.FrameLayout;
import android.widget.TextView;

public final class MainActivity extends Activity {
    private static final String PREFS = "tender_teddy_tv";
    private static final String SERVER_URL = "server_url";
    private static final String DEFAULT_URL = BuildConfig.DEFAULT_SERVER_URL;

    private WebView webView;
    private TextView statusView;
    private SharedPreferences preferences;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        preferences = getSharedPreferences(PREFS, MODE_PRIVATE);
        createScreen();
        configureWebView();
        loadTenderTeddy();
    }

    private void createScreen() {
        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(Color.rgb(23, 41, 68));

        webView = new WebView(this);
        webView.setBackgroundColor(Color.rgb(255, 248, 235));
        webView.setFocusable(true);
        webView.setFocusableInTouchMode(true);
        root.addView(webView, new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT));

        statusView = new TextView(this);
        statusView.setTextColor(Color.WHITE);
        statusView.setTextSize(18);
        statusView.setGravity(Gravity.CENTER);
        statusView.setPadding(48, 32, 48, 32);
        statusView.setBackgroundColor(Color.rgb(23, 41, 68));
        statusView.setFocusable(true);
        root.addView(statusView, new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT));

        setContentView(root);
    }

    private void configureWebView() {
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setLoadWithOverviewMode(true);
        settings.setUseWideViewPort(true);
        settings.setBuiltInZoomControls(false);
        settings.setDisplayZoomControls(false);

        webView.setWebChromeClient(new WebChromeClient());
        webView.setWebViewClient(new WebViewClient() {
            @Override
            public void onPageFinished(WebView view, String url) {
                statusView.setVisibility(TextView.GONE);
                webView.requestFocus();
                webView.evaluateJavascript(
                        "(function(){var b=document.querySelector('button:not([disabled])');if(b){b.focus();}})();",
                        null);
            }

            @Override
            public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                if (request.isForMainFrame()) showConnectionError();
            }
        });
    }

    private void loadTenderTeddy() {
        if (!hasNetwork()) {
            showStatus("TenderTeddy cannot see a network.\n\nConnect this Fire TV to Wi-Fi, then press Select to retry.\nPress Menu to change the server address.");
            return;
        }
        showStatus("Connecting to TenderTeddy…\n\nPress Menu at any time to change the server address.");
        webView.loadUrl(preferences.getString(SERVER_URL, DEFAULT_URL));
    }

    private boolean hasNetwork() {
        ConnectivityManager manager = (ConnectivityManager) getSystemService(Context.CONNECTIVITY_SERVICE);
        NetworkInfo info = manager == null ? null : manager.getActiveNetworkInfo();
        return info != null && info.isConnected();
    }

    private void showConnectionError() {
        showStatus("TenderTeddy could not reach the lesson server.\n\nCheck this Fire TV's internet connection.\nPress Select to retry or Menu to change the address.");
    }

    private void showStatus(String message) {
        statusView.setText(message);
        statusView.setVisibility(TextView.VISIBLE);
        statusView.requestFocus();
    }

    private void showServerDialog() {
        EditText input = new EditText(this);
        input.setSingleLine(true);
        input.setText(preferences.getString(SERVER_URL, DEFAULT_URL));
        input.setSelectAllOnFocus(true);
        input.setPadding(24, 18, 24, 18);

        new AlertDialog.Builder(this)
                .setTitle("TenderTeddy server address")
                .setMessage("Enter the full HTTPS address, including /test-lab.html. A local HTTP address also works on the same Wi-Fi.")
                .setView(input)
                .setPositiveButton("Connect", (dialog, which) -> {
                    String value = input.getText().toString().trim();
                    if (!value.startsWith("http://") && !value.startsWith("https://")) value = "http://" + value;
                    preferences.edit().putString(SERVER_URL, value).apply();
                    loadTenderTeddy();
                })
                .setNegativeButton("Cancel", null)
                .show();
    }

    @Override
    public boolean dispatchKeyEvent(KeyEvent event) {
        if (event.getAction() == KeyEvent.ACTION_UP && event.getKeyCode() == KeyEvent.KEYCODE_MENU) {
            showServerDialog();
            return true;
        }
        if (event.getAction() == KeyEvent.ACTION_UP
                && event.getKeyCode() == KeyEvent.KEYCODE_DPAD_CENTER
                && statusView.getVisibility() == TextView.VISIBLE) {
            loadTenderTeddy();
            return true;
        }
        return super.dispatchKeyEvent(event);
    }

    @Override
    public void onBackPressed() {
        if (webView.canGoBack()) webView.goBack();
        else super.onBackPressed();
    }

    @Override
    protected void onDestroy() {
        webView.destroy();
        super.onDestroy();
    }
}
