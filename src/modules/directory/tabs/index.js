/**
 * Entity Editor tab registry.
 *
 * The tab strip renders from this list. Adding a tab is a file plus an entry —
 * the editor shell itself does not change.
 */

import InfoTab from './InfoTab.jsx';
import HoursTab from './HoursTab.jsx';
import PhotosTab from './PhotosTab.jsx';
import TagsTab from './TagsTab.jsx';
import FeaturesTab from './FeaturesTab.jsx';
import ContentTab from './ContentTab.jsx';
import SectionsTab from './SectionsTab.jsx';
import CollectionsTab from './CollectionsTab.jsx';
import PagesTab from './PagesTab.jsx';
import CalendarTab from './CalendarTab.jsx';
import AttributesTab from './AttributesTab.jsx';

export const entityTabs = [
  { id: 'info', label: 'Info', icon: 'ℹ️', component: InfoTab },
  { id: 'hours', label: 'Hours', icon: '🕐', component: HoursTab },
  { id: 'photos', label: 'Photos', icon: '🖼️', component: PhotosTab },
  { id: 'tags', label: 'Tags', icon: '🏷️', component: TagsTab },
  { id: 'features', label: 'Features', icon: '✅', component: FeaturesTab },
  { id: 'content', label: 'Content', icon: '📋', component: ContentTab },
  { id: 'sections', label: 'Sections', icon: '🧱', component: SectionsTab },
  { id: 'details', label: 'Details', icon: '📑', component: CollectionsTab },
  { id: 'pages', label: 'Pages', icon: '🗂️', component: PagesTab },
  { id: 'attributes', label: 'Listing Data', icon: '📐', component: AttributesTab },
  // Last, because it is the only tab that reads rather than edits.
  { id: 'calendar', label: 'Calendar', icon: '🗓️', component: CalendarTab },
];

export default entityTabs;
