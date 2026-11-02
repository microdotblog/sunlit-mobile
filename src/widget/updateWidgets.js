import { Platform } from 'react-native';
import { requestWidgetUpdate } from 'react-native-android-widget';

import { build_widget } from './widgetData';
import { WIDGET_NAME } from './widgetModel';

export async function update_widgets() {
  if (Platform.OS !== 'android') {
    return;
  }

  try {
    await requestWidgetUpdate({ widgetName: WIDGET_NAME, renderWidget: build_widget });
  } catch (error) {
    console.error('Could not update the Sunlit widget.', error);
  }
}
