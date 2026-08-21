import { Link, useLocation } from 'react-router-dom';

export function NotFound() {
  const { pathname } = useLocation();

  return (
    <div className="notfound">
      <p className="eyebrow">Nothing here</p>
      <h1 className="notfound__title">
        No memory at
        <br />
        <em>this address</em>
      </h1>
      <p className="notfound__path tnum">{pathname}</p>
      <div className="notfound__actions">
        <Link to="/" className="btn btn--voice">
          Back to Recall
        </Link>
        <Link to="/space" className="btn btn--quiet">
          Open Memory Space
        </Link>
      </div>
    </div>
  );
}
