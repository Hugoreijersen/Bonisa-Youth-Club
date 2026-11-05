// When a Supabase invitation or password link redirects to the homepage (the
// "Site URL"), pass the login in the fragment on to /welkom/.
if (/[#&](type=(invite|recovery)|error_code=)/.test(location.hash)) {
  location.replace(`/welkom/${location.hash}`);
}
