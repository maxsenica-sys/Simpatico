package app.simpatico;

import android.content.Context;
import android.media.AudioDeviceInfo;
import android.media.AudioManager;
import android.os.Build;
import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

/**
 * Simpatico's main screen: Capacitor's web view loading the Simpatico web app. Call audio goes
 * to the loudspeaker (a video call held at arm's length), or to a headset when one is connected.
 */
public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setVolumeControlStream(AudioManager.STREAM_VOICE_CALL);
    }

    @Override
    public void onResume() {
        super.onResume();
        routeToSpeaker();
    }

    private void routeToSpeaker() {
        AudioManager am = (AudioManager) getSystemService(Context.AUDIO_SERVICE);
        if (am == null) return;
        am.setMode(AudioManager.MODE_IN_COMMUNICATION);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            // A wired or Bluetooth headset wins; otherwise the built-in loudspeaker.
            AudioDeviceInfo speaker = null;
            for (AudioDeviceInfo d : am.getAvailableCommunicationDevices()) {
                int t = d.getType();
                if (t == AudioDeviceInfo.TYPE_BLUETOOTH_SCO || t == AudioDeviceInfo.TYPE_WIRED_HEADSET || t == AudioDeviceInfo.TYPE_USB_HEADSET || t == AudioDeviceInfo.TYPE_BLE_HEADSET) return;
                if (t == AudioDeviceInfo.TYPE_BUILTIN_SPEAKER) speaker = d;
            }
            if (speaker != null) am.setCommunicationDevice(speaker);
        } else if (!am.isWiredHeadsetOn() && !am.isBluetoothScoOn()) {
            am.setSpeakerphoneOn(true);
        }
    }
}
