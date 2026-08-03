/**
 * The Attributes tab on a business's profile.
 *
 * Same panel as everywhere else, so listing data is edited identically whether
 * you reached it through the profile or through the booking section.
 */

import { Link } from 'react-router-dom';
import AttributesPanel from '../../booking/AttributesPanel.jsx';

export default function AttributesTab({ slug }) {
  return (
    <>
      <p className="muted" style={{ marginBottom: 'var(--space-4)' }}>
        The structured fields a guest searches on — what this would hold if it were listed on
        Airbnb, VRBO or FareHarbor. <Link to="/booking/match">Try a search against them</Link>.
      </p>
      <AttributesPanel slug={slug} />
    </>
  );
}
