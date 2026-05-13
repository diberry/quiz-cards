declare module 'connect-sqlite3' {
  import type session from 'express-session';
  function connectSqlite3(
    sess: typeof session,
  ): new (options?: { db?: string; dir?: string }) => session.Store;
  export = connectSqlite3;
}
