%{?nodejs_find_provides_and_requires}
%global homedir   %{_localstatedir}/lib/remote-pdf-printer
%global user      pdf

Name:       remote-pdf-printer
Version:    2.0.16
Release:    4%{?dist}
Summary:    Server that accepts HTML/URLs and converts to PDFs

License:    MIT
URL:        https://github.com/NobletSolutions/remote-pdf-printer
Source0:    %{name}-%{version}.tgz
Source1:    remote-pdf-printer.service
Source2:    remote-pdf-printer.sysconf
Source3:    remote-pdf-printer-clean.service
Source4:    remote-pdf-printer-clean.timer

BuildRequires:  nodejs-packaging systemd
Requires:       nodejs >= 8.0 chrome-headless poppler-utils
ExclusiveArch:  %{nodejs_arches} noarch

%description
NODEJS Server that accepts HTML/URLs and converts to PDFs

%pre
getent group %{user} >/dev/null || groupadd -r %{user}
getent passwd %{user} >/dev/null || useradd -r -g %{user} -d %{homedir} -s /sbin/nologin -c 'User to own remote-pdf-printer directories and default processes' %{user}
exit 0

%post
%systemd_post remote-pdf-printer.service
%systemd_post remote-pdf-printer-clean.timer

%preun
%systemd_preun remote-pdf-printer.service
%systemd_preun remote-pdf-printer-clean.service
%systemd_preun remote-pdf-printer-clean.timer

%postun
%systemd_postun_with_restart remote-pdf-printer.service
%systemd_postun_with_restart remote-pdf-printer-clean.timer

%prep
%setup -q -n package

%build

%install
%{__install} -Dp -m0644 %{SOURCE1} $RPM_BUILD_ROOT%{_unitdir}/remote-pdf-printer.service
%{__install} -Dp -m0644 %{SOURCE3} $RPM_BUILD_ROOT%{_unitdir}/
%{__install} -Dp -m0644 %{SOURCE4} $RPM_BUILD_ROOT%{_unitdir}/
%{__install} -Dp -m0644 %{SOURCE2} $RPM_BUILD_ROOT%{_sysconfdir}/sysconfig/remote-pdf-printer
%{__install} -Dp -m0640 server.js $RPM_BUILD_ROOT%{homedir}/server.js
%{__install} -Dp -m0440 package.json $RPM_BUILD_ROOT%{homedir}/package.json
%{__install} -dp $RPM_BUILD_ROOT%{homedir}/node_modules
%{__install} -dp $RPM_BUILD_ROOT%{homedir}/files/{previews,sources,pdfs,pngs}
%{__install} -dp $RPM_BUILD_ROOT%{homedir}/api/controllers
%{__install} -dp $RPM_BUILD_ROOT%{homedir}/api/routes

%{__install} -Dp -m0440 api/controllers/*js $RPM_BUILD_ROOT%{homedir}/api/controllers/
%{__install} -Dp -m0440 api/routes/*.js $RPM_BUILD_ROOT%{homedir}/api/routes/
cp -a node_modules/* $RPM_BUILD_ROOT%{homedir}/node_modules/
find $RPM_BUILD_ROOT%{homedir}/node_modules -name ".travis.yml" -exec rm {} \;
find $RPM_BUILD_ROOT%{homedir}/node_modules -name ".npmignore" -exec rm {} \;
find $RPM_BUILD_ROOT%{homedir}/node_modules -name ".nycrc" -exec rm {} \;
find $RPM_BUILD_ROOT%{homedir}/node_modules -name ".eslint*" -exec rm {} \;
find $RPM_BUILD_ROOT%{homedir}/node_modules -name ".jshintrc" -exec rm {} \;
rm -rf $RPM_BUILD_ROOT%{homedir}/node_modules/unique-filename/.nyc_output
rm -rf $RPM_BUILD_ROOT%{homedir}/node_modules/qs/{.editorconfig,.github}
rm -rf $RPM_BUILD_ROOT%{homedir}/node_modules/debug/.coveralls.yml


%files
%doc
%{_unitdir}/remote-pdf-printer.service
%{_unitdir}/remote-pdf-printer-clean.service
%{_unitdir}/remote-pdf-printer-clean.timer
%config(noreplace) %{_sysconfdir}/sysconfig/remote-pdf-printer
%attr(0770,%{user},%{user}) %dir %{homedir}
%attr(0770,%{user},%{user}) %dir %{homedir}/node_modules
%attr(0770,%{user},%{user}) %dir %{homedir}/node_modules/*
%attr(0440,%{user},%{user}) %{homedir}/node_modules/*/*
%attr(0770,%{user},%{user}) %dir %{homedir}/files
%attr(0770,%{user},%{user}) %dir %{homedir}/files/*
%{homedir}/server.js
%attr(0440,%{user},%{user}) %{homedir}/package.json
%{homedir}/api/controllers/*.js
%{homedir}/api/routes/*.js

%changelog
* Mon Sep 19 2022 Nathanael Noblet <nathanael@gnat.ca> - 2.0.16-2
- Added systemd timers to clean the directories monthly

* Thu Sep 1 2022 Nathanael Noblet <nathanael@gnat.ca> - 2.0.16-1
- New release
- Support page size

* Mon Mar 9 2020 Nathanael Noblet <nathanael@gnat.ca> - 2.0.15-1
- Bundle all dependencies for smoother installs

* Fri Dec 14 2018 Nathanael Noblet <nathanael@gnat.ca> - 2.0.0-1
- New Release 
- Refactored urls
- Added screenshot

* Fri Oct 26 2018 Nathanael Noblet <nathanael@gnat.ca> - 1.1.13-1
- New Release (fixes header/footer scaling margin issue)

* Thu Oct 25 2018 Nathanael Noblet <nathanael@gnat.ca> - 1.1.12-1
- New Release (support header/footers)

* Tue Oct 23 2018 Nathanael Noblet <nathanael@gnat.ca> - 1.1.10-1
- New Release

* Thu Sep 14 2017 Nathanael Noblet <nathanael@gnat.ca> - 1.1.9-1
- New Release

* Mon Aug 14 2017 Nathanael Noblet <nathanael@gnat.ca> - 1.1.7-2
- New release + require newer nodejs

* Thu Jul 27 2017 Nathanael Noblet <nathanael@gnat.ca> - 1.1.5-1
- New Release - added HSTS

* Thu Jul 27 2017 Nathanael Noblet <nathanael@gnat.ca> - 1.1.4-1
- New Release - support SSL_CA

* Tue Jul 25 2017 Nathanael Noblet <nathanael@gnat.ca> - 1.1.2-1
- New release - fixed post html and get pdf errors

* Tue Jul 25 2017 Nathanael Noblet <nathanael@gnat.ca> - 1.1.1-1
- New release - now more stable!

* Sat Jul 22 2017 Nathanael Noblet <nathanael@gnat.ca> - 1.0.1-1
- New release

* Fri Jul 21 2017 Nathanael Noblet <nathanael@gnat.ca> - 1.0.0-3
- Marked /etc/sysconfig/remote-pdf-printer as no replace config

* Fri Jul 21 2017 Nathanael Noblet <nathanael@gnat.ca> - 1.0.0-2
- Fixed perms of package.json

* Fri Jul 21 2017 Nathanael Noblet <nathanael@gnat.ca> - 1.0.0-1
- Initial Package

