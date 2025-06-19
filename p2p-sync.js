const BleManager = typeof window !== 'undefined' && window.navigator?.product === 'ReactNative' ? 
  require('react-native-ble-plx').default : null;

const P2P_CONFIG = {
  webrtc: {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' }
    ]
  }
};

class P2PSync {
  constructor() {
    this.peers = new Map();
    this.connections = new Map();
    this.isReactNative = typeof window !== 'undefined' && window.navigator?.product === 'ReactNative';
    
    if (this.isReactNative) {
      this.bleManager = BleManager ? new BleManager() : null;
    } else {
      this.initWebRTC();
    }
  }

  initWebRTC() {
    if (typeof window === 'undefined') return;

    this.peerConnection = new RTCPeerConnection(P2P_CONFIG.webrtc);
    this.dataChannel = this.peerConnection.createDataChannel('lighttable-sync');
    
    this.peerConnection.onicecandidate = event => {
      if (event.candidate) {
        this.broadcastICECandidate(event.candidate);
      }
    };

    this.dataChannel.onmessage = event => {
      this.handleIncomingData(JSON.parse(event.data));
    };
  }

  async startAdvertising() {
    if (this.isReactNative && this.bleManager) {
      return this.startBLEAdvertising();
    } else {
      return this.startWebRTCAdvertising();
    }
  }

  async startBLEAdvertising() {
    if (!this.bleManager) return;
    
    try {
      await this.bleManager.startAdvertising({
        serviceUUIDs: ['LIGHTTABLE_SERVICE'],
        localName: 'LightTable Sync'
      });
      console.log('[P2P] BLE advertising started');
    } catch (error) {
      console.error('[P2P] BLE advertising error:', error);
    }
  }

  async startWebRTCAdvertising() {
    try {
      // Utilisation de la découverte locale via WebRTC
      const offer = await this.peerConnection.createOffer();
      await this.peerConnection.setLocalDescription(offer);
      
      // Broadcast l'offre sur le réseau local via WebSocket ou autre mécanisme
      this.broadcastOffer(offer);
      
      console.log('[P2P] WebRTC advertising started');
    } catch (error) {
      console.error('[P2P] WebRTC advertising error:', error);
    }
  }

  broadcastOffer(offer) {
    // Implémentation de la diffusion de l'offre sur le réseau local
    // Peut utiliser WebSocket, WebRTC-Discovery ou autre mécanisme
    console.log('[P2P] Broadcasting offer:', offer);
  }

  broadcastICECandidate(candidate) {
    // Diffusion des candidats ICE aux pairs
    console.log('[P2P] Broadcasting ICE candidate:', candidate);
  }

  async handleIncomingData(data) {
    // Traitement des données reçues
    if (!data.token) {
      console.warn('[P2P] Message sans token, ignoré');
      return;
    }
    if (this.onDataReceived) {
      await this.onDataReceived(data.collection, data.changes, data.token);
    }
  }

  async sendData(data) {
    if (this.isReactNative && this.bleManager) {
      // Envoi via BLE
      for (const [peerId, connection] of this.connections) {
        try {
          const encoded = Buffer.from(JSON.stringify(data)).toString('base64');
          await connection.writeCharacteristicWithResponse(
            'LIGHTTABLE_SERVICE',
            'SYNC_CHARACTERISTIC',
            encoded
          );
        } catch (error) {
          console.error(`[P2P] Failed to send data to ${peerId}:`, error);
        }
      }
    } else if (this.dataChannel?.readyState === 'open') {
      // Envoi via WebRTC
      this.dataChannel.send(JSON.stringify(data));
    }
  }

  async cleanup() {
    if (this.isReactNative && this.bleManager) {
      await this.bleManager.destroy();
    } else if (this.peerConnection) {
      this.peerConnection.close();
    }
    
    this.peers.clear();
    this.connections.clear();
  }
}

// Instance singleton
const p2pSync = new P2PSync();

module.exports = p2pSync; 