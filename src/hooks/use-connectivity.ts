import * as Network from 'expo-network';
import { AppState } from 'react-native';
import { useCallback, useEffect, useState } from 'react';

export type ConnectivityState = 'unknown' | 'online' | 'offline';

function resolveState(state: Network.NetworkState): ConnectivityState {
  if (state.isConnected === false) return 'offline';
  if (state.isConnected === true) return 'online';

  return 'unknown';
}

export async function getCurrentConnectivityState(): Promise<ConnectivityState> {
  try {
    return resolveState(await Network.getNetworkStateAsync());
  } catch {
    return 'unknown';
  }
}

export function useConnectivity(): ConnectivityState {
  const [connectivity, setConnectivity] = useState<ConnectivityState>('unknown');

  const refreshConnectivity = useCallback(async () => {
    setConnectivity(await getCurrentConnectivityState());
  }, []);

  useEffect(() => {
    let mounted = true;

    getCurrentConnectivityState().then((state) => {
      if (mounted) setConnectivity(state);
    });

    const networkSubscription = Network.addNetworkStateListener((state) => {
      if (mounted) setConnectivity(resolveState(state));
    });

    const appStateSubscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        refreshConnectivity().catch(() => undefined);
      }
    });

    return () => {
      mounted = false;
      networkSubscription.remove();
      appStateSubscription.remove();
    };
  }, [refreshConnectivity]);

  useEffect(() => {
    if (connectivity === 'online') return;

    const timer = setInterval(() => {
      refreshConnectivity().catch(() => undefined);
    }, 3000);

    return () => clearInterval(timer);
  }, [connectivity, refreshConnectivity]);

  return connectivity;
}
