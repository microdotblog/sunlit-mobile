import 'react-native-gesture-handler';
import { registerRootComponent } from 'expo';
import { registerWidgetConfigurationScreen, registerWidgetTaskHandler } from 'react-native-android-widget';

import App from './App';
import WidgetConfigurationScreen from './widget/WidgetConfigurationScreen';
import { widget_task_handler } from './widget/widgetTaskHandler';

registerRootComponent(App);
registerWidgetTaskHandler(widget_task_handler);
registerWidgetConfigurationScreen(WidgetConfigurationScreen);
