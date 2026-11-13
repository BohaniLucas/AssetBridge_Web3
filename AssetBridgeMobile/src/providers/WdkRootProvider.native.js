import React from 'react';
import { WdkAppProvider } from '@tetherto/wdk-react-native-core';
import { bundle } from '../../.wdk';
import { WdkBridgeProvider } from '../services/wdkBridgeService';

export default function WdkRootProvider({ children, wdkConfigs }) {
  return (
    <WdkAppProvider bundle={{ bundle }} wdkConfigs={wdkConfigs}>
      <WdkBridgeProvider>{children}</WdkBridgeProvider>
    </WdkAppProvider>
  );
}
