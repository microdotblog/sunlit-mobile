import { build_widget, forget_widget_config } from './widgetData';

const RENDER_ACTIONS = ['WIDGET_ADDED', 'WIDGET_UPDATE', 'WIDGET_RESIZED'];

export async function widget_task_handler({ widgetInfo, widgetAction, renderWidget }) {
  if (widgetAction === 'WIDGET_DELETED') {
    await forget_widget_config(widgetInfo.widgetId);
  } else if (RENDER_ACTIONS.includes(widgetAction)) {
    renderWidget(await build_widget(widgetInfo));
  }
}
