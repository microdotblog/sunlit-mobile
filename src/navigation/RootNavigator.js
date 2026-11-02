import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { observer } from 'mobx-react';

import Icon from '../platform/Icon';
import AltTextScreen from '../screens/AltTextScreen';
import ComposerScreen from '../screens/ComposerScreen';
import ConversationScreen from '../screens/ConversationScreen';
import DestinationsScreen from '../screens/DestinationsScreen';
import DiscoverScreen from '../screens/DiscoverScreen';
import FollowingScreen from '../screens/FollowingScreen';
import ImageViewerScreen from '../screens/ImageViewerScreen';
import MentionsScreen from '../screens/MentionsScreen';
import ProfileScreen from '../screens/ProfileScreen';
import SettingsScreen from '../screens/SettingsScreen';
import TimelineScreen from '../screens/TimelineScreen';
import UploadsScreen from '../screens/UploadsScreen';
import Auth from '../stores/Auth';
import { use_theme } from '../theme/theme';
import { AccountButton, HeaderIconButton } from './headers';
import TabBar from './TabBar';

const Stack = createNativeStackNavigator();
const Tabs = createBottomTabNavigator();

const Home = observer(function Home() {
  const theme = use_theme();
  const is_signed_in = Auth.is_signed_in();

  return (
    <Tabs.Navigator
      screenOptions={({ navigation }) => ({
        headerRight: () => <AccountButton navigation={navigation} />,
        headerShadowVisible: false,
        headerStyle: { backgroundColor: theme.colors.canvas },
        headerTitleAlign: 'left',
      })}
      tabBar={props => <TabBar {...props} />}
    >
      <Tabs.Screen
        component={TimelineScreen}
        name="Timeline"
        options={{ tabBarIcon: ({ color }) => <Icon color={color} name="timeline" size={24} /> }}
      />
      {is_signed_in ? (
        <Tabs.Screen
          component={MentionsScreen}
          name="Mentions"
          options={{ tabBarIcon: ({ color }) => <Icon color={color} name="mentions" size={24} /> }}
        />
      ) : null}
      <Tabs.Screen
        component={DiscoverScreen}
        name="Discover"
        options={{ tabBarIcon: ({ color }) => <Icon color={color} name="discover" size={24} /> }}
      />
    </Tabs.Navigator>
  );
});

function RootNavigator() {
  const theme = use_theme();

  return (
    <Stack.Navigator
      screenOptions={{
        headerShadowVisible: false,
        headerStyle: { backgroundColor: theme.colors.canvas },
        headerTintColor: theme.colors.ink,
        statusBarStyle: theme.is_dark ? 'light' : 'dark',
      }}
    >
      <Stack.Screen component={Home} name="Home" options={{ headerShown: false }} />
      <Stack.Screen component={ConversationScreen} name="Conversation" options={{ title: 'Conversation' }} />
      <Stack.Screen component={ProfileScreen} name="Profile" />
      <Stack.Screen component={FollowingScreen} name="Following" options={{ title: 'Following' }} />
      <Stack.Screen component={SettingsScreen} name="Settings" />
      <Stack.Screen
        component={ComposerScreen}
        name="Composer"
        options={({ navigation }) => ({
          headerLeft: () => <HeaderIconButton icon="close" label="Close" on_press={() => navigation.goBack()} />,
          presentation: 'fullScreenModal',
          title: 'New post',
        })}
      />
      <Stack.Screen component={AltTextScreen} name="AltText" options={{ presentation: 'modal', title: 'Description' }} />
      <Stack.Screen component={DestinationsScreen} name="Destinations" options={{ presentation: 'modal', title: 'Post to' }} />
      <Stack.Screen component={UploadsScreen} name="Uploads" options={{ title: 'Micro.blog uploads' }} />
      <Stack.Screen
        component={ImageViewerScreen}
        name="ImageViewer"
        options={{
          animation: 'fade',
          headerShown: false,
          presentation: 'fullScreenModal',
          statusBarStyle: 'light',
        }}
      />
    </Stack.Navigator>
  );
}

export default observer(RootNavigator);
