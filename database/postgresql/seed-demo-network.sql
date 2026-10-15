-- GovCare synthetic hospital network, version 1. Local development / QA only.
-- Run npm run demo:seed after Flyway V32. This is deliberately NOT a migration.
-- Reserved codes DEMO-HOSP-01..10; inserts are repeatable and never reset data.
begin;

do $$
begin
  if current_setting('govcare.allow_demo_seed', true) is distinct from 'on' then
    raise exception 'Demo data must be explicitly enabled. Run npm run demo:seed.';
  end if;
  if inet_server_addr() is not null
     and inet_server_addr() not in ('127.0.0.1'::inet, '::1'::inet) then
    raise exception 'The demo network loader supports a loopback PostgreSQL server only.';
  end if;
  if not exists(select 1 from flyway_schema_history where version='32' and success) then
    raise exception 'Start the updated Spring API first. Flyway V32 must be applied.';
  end if;
  perform pg_advisory_xact_lock(741032, 101);
  if exists(select 1 from hospitals
      where code ~ '^DEMO-HOSP-(0[1-9]|10)$'
        and settings->>'govcare_demo_fixture' is distinct from 'network-v1') then
    raise exception 'A reserved demo hospital code is owned by an existing hospital. No data was changed.';
  end if;
  if (select count(*) from roles where code in ('doctor','hospital_admin','receptionist','nurse','ward_manager','patient','guardian')) <> 7 then
    raise exception 'The required role definitions are missing. Complete the database upgrade first.';
  end if;
end $$;

create temporary table _gc_demo_accounts (
  hospital_index integer not null,
  role_code text not null,
  full_name text not null,
  email text primary key,
  employee_no text not null unique,
  auth_uid text not null unique,
  department_code text,
  password_hash text not null
) on commit drop;

-- Unique, precomputed bcrypt-10 hashes; initial passwords are in the demo CSV.
-- No runtime dependency or bcrypt loop is needed when inserting 1,060 accounts.
insert into _gc_demo_accounts values
  (1,'doctor','Dr. Demo Doctor H01 001','doctor.h01.001@govcare.test','GCD-H01-DOC-001','govcare-demo-network-v1:h01:doctor:001','DEMO-WARD-001','$2a$10$lFIXC3WcZbOw0DZvYowbouKXb6DCfIJwkpjMfD1LJBXB2yBSnrc8O'),
  (1,'doctor','Dr. Demo Doctor H01 002','doctor.h01.002@govcare.test','GCD-H01-DOC-002','govcare-demo-network-v1:h01:doctor:002','DEMO-WARD-002','$2a$10$dE2E/WmOTFtyuK.tO1bzruL8c9BlnYd8M5Vem7ieUBpN/.Ha0T.Lq'),
  (1,'doctor','Dr. Demo Doctor H01 003','doctor.h01.003@govcare.test','GCD-H01-DOC-003','govcare-demo-network-v1:h01:doctor:003','DEMO-WARD-003','$2a$10$1cJ4yybL7x5DhXqHAb23kuW27pMelwE.tQDvSb2YFVsLpZI7FbMGK'),
  (1,'doctor','Dr. Demo Doctor H01 004','doctor.h01.004@govcare.test','GCD-H01-DOC-004','govcare-demo-network-v1:h01:doctor:004','DEMO-WARD-004','$2a$10$nRMzRaczogYDyx/nRnNtF.1tffyZDyKL3Q/coQYwAAfw95d5Gs08y'),
  (1,'doctor','Dr. Demo Doctor H01 005','doctor.h01.005@govcare.test','GCD-H01-DOC-005','govcare-demo-network-v1:h01:doctor:005','DEMO-WARD-005','$2a$10$omydilH9TsaomC4MhYI82OHJgMTpvB2tFfa4Bee6k6Ocn2eKmNrB2'),
  (1,'doctor','Dr. Demo Doctor H01 006','doctor.h01.006@govcare.test','GCD-H01-DOC-006','govcare-demo-network-v1:h01:doctor:006','DEMO-WARD-006','$2a$10$lswC6IILvtxtTXcaao/SL.EmQoBf/tHSLeobCSZQ3cYNJjwNq8zji'),
  (1,'doctor','Dr. Demo Doctor H01 007','doctor.h01.007@govcare.test','GCD-H01-DOC-007','govcare-demo-network-v1:h01:doctor:007','DEMO-WARD-007','$2a$10$HQcgoION.2cuPYCxEb8BSO1tyCj9h/DRp/23lL3QJdF3moEbJdj2q'),
  (1,'doctor','Dr. Demo Doctor H01 008','doctor.h01.008@govcare.test','GCD-H01-DOC-008','govcare-demo-network-v1:h01:doctor:008','DEMO-WARD-008','$2a$10$RMFoIcS3jtJ9nzvbT9O7eerSrdxeL6Ph7ltdz5v11X7rwFDx.81HO'),
  (1,'doctor','Dr. Demo Doctor H01 009','doctor.h01.009@govcare.test','GCD-H01-DOC-009','govcare-demo-network-v1:h01:doctor:009','DEMO-WARD-009','$2a$10$goe81.T4.gDwbvs0W13ay.Gi3TQARgfGsvui9JzCXyl4kr6Z/IXI2'),
  (1,'doctor','Dr. Demo Doctor H01 010','doctor.h01.010@govcare.test','GCD-H01-DOC-010','govcare-demo-network-v1:h01:doctor:010','DEMO-WARD-010','$2a$10$zXl9qf41roREARxXK.o69umq9411oYu.zfTfzVCLw7e5HKW3AKTha'),
  (1,'doctor','Dr. Demo Doctor H01 011','doctor.h01.011@govcare.test','GCD-H01-DOC-011','govcare-demo-network-v1:h01:doctor:011','DEMO-WARD-011','$2a$10$f9lnTV5TZbHvO08CJPlv3eJlnK4271O.SQFNinhmTftCiUEZucZQi'),
  (1,'doctor','Dr. Demo Doctor H01 012','doctor.h01.012@govcare.test','GCD-H01-DOC-012','govcare-demo-network-v1:h01:doctor:012','DEMO-WARD-012','$2a$10$ppI8vXkq7CkyCsva3Bw/y.4HFvyGy3InRSE7Vb2cZ2UMCPchpAPPS'),
  (1,'doctor','Dr. Demo Doctor H01 013','doctor.h01.013@govcare.test','GCD-H01-DOC-013','govcare-demo-network-v1:h01:doctor:013','DEMO-WARD-013','$2a$10$.nHJaYmBnd9bXsUZKXOv/OQhi3IMVOI1ArSdELF8zdiQly9OalT52'),
  (1,'doctor','Dr. Demo Doctor H01 014','doctor.h01.014@govcare.test','GCD-H01-DOC-014','govcare-demo-network-v1:h01:doctor:014','DEMO-WARD-014','$2a$10$gYGFMcgNneg/x2KZaGODCO4jXBsjwRjhz1GG9mQWsDv7KrFCCPjRC'),
  (1,'doctor','Dr. Demo Doctor H01 015','doctor.h01.015@govcare.test','GCD-H01-DOC-015','govcare-demo-network-v1:h01:doctor:015','DEMO-WARD-015','$2a$10$mpIK53KAhTXewyKYYijqfu1D9RXUVzk5IEGKJ4Z82X7tCJUhqQ9g2'),
  (1,'doctor','Dr. Demo Doctor H01 016','doctor.h01.016@govcare.test','GCD-H01-DOC-016','govcare-demo-network-v1:h01:doctor:016','DEMO-WARD-016','$2a$10$zuFEWH49Icc6//3d.rSX.enzEH58UJU88Y.QVPjynCaxEiQG/6bJe'),
  (1,'doctor','Dr. Demo Doctor H01 017','doctor.h01.017@govcare.test','GCD-H01-DOC-017','govcare-demo-network-v1:h01:doctor:017','DEMO-WARD-017','$2a$10$J225FuLzyTrjsOVHl4HcVujrsXdqc9EVvNbg1WORY.f4CSu6pGmKS'),
  (1,'doctor','Dr. Demo Doctor H01 018','doctor.h01.018@govcare.test','GCD-H01-DOC-018','govcare-demo-network-v1:h01:doctor:018','DEMO-WARD-018','$2a$10$Dsb13/ryZe3aoiOMuYOviut1ojofBcxkOn.vMRWcYIGFWe76Fe352'),
  (1,'doctor','Dr. Demo Doctor H01 019','doctor.h01.019@govcare.test','GCD-H01-DOC-019','govcare-demo-network-v1:h01:doctor:019','DEMO-WARD-019','$2a$10$xcBk1B.LzOla1j8mSDNfUuC3Bg0Y1UPc3eIzE24Qx6gkaiqurtNdO'),
  (1,'doctor','Dr. Demo Doctor H01 020','doctor.h01.020@govcare.test','GCD-H01-DOC-020','govcare-demo-network-v1:h01:doctor:020','DEMO-WARD-020','$2a$10$5IWZ5uagg4wqcWcmnGu0GufMnwZu0Qr4poiFmdiqpCUwG4FmDXHOi'),
  (1,'doctor','Dr. Demo Doctor H01 021','doctor.h01.021@govcare.test','GCD-H01-DOC-021','govcare-demo-network-v1:h01:doctor:021','DEMO-WARD-021','$2a$10$3nZWzFVo0obJDay/0ry/NOySrDtM7C6qnV.0V9nhji193mlPCalki'),
  (1,'doctor','Dr. Demo Doctor H01 022','doctor.h01.022@govcare.test','GCD-H01-DOC-022','govcare-demo-network-v1:h01:doctor:022','DEMO-WARD-022','$2a$10$hBujW.rQkkJqX5G6a3IFj.E8SJEaNVnHbyNJ0LrSlEpRSsumEKRc.'),
  (1,'doctor','Dr. Demo Doctor H01 023','doctor.h01.023@govcare.test','GCD-H01-DOC-023','govcare-demo-network-v1:h01:doctor:023','DEMO-WARD-023','$2a$10$.se1EJnytNNrTeSDFEO13OHTXymsAx0uxFvCU6lh19vzd6aTQf0ze'),
  (1,'doctor','Dr. Demo Doctor H01 024','doctor.h01.024@govcare.test','GCD-H01-DOC-024','govcare-demo-network-v1:h01:doctor:024','DEMO-WARD-024','$2a$10$2wZbuzjaa2lsKlBZCeqHdOf8.5vmlibYc.eDvoMPWgDzdh8Qmecz6'),
  (1,'doctor','Dr. Demo Doctor H01 025','doctor.h01.025@govcare.test','GCD-H01-DOC-025','govcare-demo-network-v1:h01:doctor:025','DEMO-WARD-025','$2a$10$lVFObQOUFvOQgAQujC9rDOqUgAwQ2h4HqfzHA6KgyzTnXAtVr0V3W'),
  (1,'doctor','Dr. Demo Doctor H01 026','doctor.h01.026@govcare.test','GCD-H01-DOC-026','govcare-demo-network-v1:h01:doctor:026','DEMO-WARD-026','$2a$10$h2z3xPIxwpjM.rbrmQRpkOKFJSjAPIv4hSxBYvKSM4EjOyZHfUOP.'),
  (1,'doctor','Dr. Demo Doctor H01 027','doctor.h01.027@govcare.test','GCD-H01-DOC-027','govcare-demo-network-v1:h01:doctor:027','DEMO-WARD-027','$2a$10$hZ.KHnLSLbaYjg1t40Rz8etiRMVPWVM08BQMv2CEp9gsSXJh2Amhi'),
  (1,'doctor','Dr. Demo Doctor H01 028','doctor.h01.028@govcare.test','GCD-H01-DOC-028','govcare-demo-network-v1:h01:doctor:028','DEMO-WARD-028','$2a$10$PKA.rhoFOrS64ngPDkH2COk78YikwhsLoR3f.p1nITFDoyCqKLTs.'),
  (1,'doctor','Dr. Demo Doctor H01 029','doctor.h01.029@govcare.test','GCD-H01-DOC-029','govcare-demo-network-v1:h01:doctor:029','DEMO-WARD-029','$2a$10$XvldbzWSnq0DPLzOIW8oTeVLjINhOLFfiuh3SpLMr93Sd0x/18ssm'),
  (1,'doctor','Dr. Demo Doctor H01 030','doctor.h01.030@govcare.test','GCD-H01-DOC-030','govcare-demo-network-v1:h01:doctor:030','DEMO-WARD-030','$2a$10$jj0PkUdCf5lyLuEbLY0U/ujg7KLsC7pqb3Pgdy4iuVATJ/ZfCDHYq'),
  (1,'doctor','Dr. Demo Doctor H01 031','doctor.h01.031@govcare.test','GCD-H01-DOC-031','govcare-demo-network-v1:h01:doctor:031','DEMO-WARD-031','$2a$10$SxmwnD4m9CJTIYzAfRioUe.HPlSBfHyxzl5Dzxgdzi/KrqtjpzVJW'),
  (1,'doctor','Dr. Demo Doctor H01 032','doctor.h01.032@govcare.test','GCD-H01-DOC-032','govcare-demo-network-v1:h01:doctor:032','DEMO-WARD-032','$2a$10$XaV8.jvoz5/56QJJQna1LOCmo/ltwBN/weYQusFGZxK0.g1w1xbDa'),
  (1,'doctor','Dr. Demo Doctor H01 033','doctor.h01.033@govcare.test','GCD-H01-DOC-033','govcare-demo-network-v1:h01:doctor:033','DEMO-WARD-033','$2a$10$S0bgI8XnjIQsuxKAMrBPEep2Yh7gBIxpb/6P7Fx/Coc92SvRoi6gK'),
  (1,'doctor','Dr. Demo Doctor H01 034','doctor.h01.034@govcare.test','GCD-H01-DOC-034','govcare-demo-network-v1:h01:doctor:034','DEMO-WARD-034','$2a$10$hPWpnxUgKxnUpCsYCzy.gelPw3pG31Zl.il4B4Gxdj47kFWB.K6oG'),
  (1,'doctor','Dr. Demo Doctor H01 035','doctor.h01.035@govcare.test','GCD-H01-DOC-035','govcare-demo-network-v1:h01:doctor:035','DEMO-WARD-035','$2a$10$19rfS.7Lax8N8kCU5.mIku2Z6c1dtbnJQQkEgzEyWvcEipdKf71ym'),
  (1,'doctor','Dr. Demo Doctor H01 036','doctor.h01.036@govcare.test','GCD-H01-DOC-036','govcare-demo-network-v1:h01:doctor:036','DEMO-WARD-036','$2a$10$MJ7K9ABOBo1xEspkasastOgHiePEiyWl55NqDqJkrHhxzw3Btx2WO'),
  (1,'doctor','Dr. Demo Doctor H01 037','doctor.h01.037@govcare.test','GCD-H01-DOC-037','govcare-demo-network-v1:h01:doctor:037','DEMO-WARD-037','$2a$10$4P7vKZeS8j74k3fNJaCKNubZOfB/kSATnjTPZdLtOKd0zXRynO.Qy'),
  (1,'doctor','Dr. Demo Doctor H01 038','doctor.h01.038@govcare.test','GCD-H01-DOC-038','govcare-demo-network-v1:h01:doctor:038','DEMO-WARD-038','$2a$10$eUCswPC0kD7uLNUx3LDcO.KSOIlLPge.hJzp70yj28RqBiRRhmpCy'),
  (1,'doctor','Dr. Demo Doctor H01 039','doctor.h01.039@govcare.test','GCD-H01-DOC-039','govcare-demo-network-v1:h01:doctor:039','DEMO-WARD-039','$2a$10$CR0F9mNwwXVvoQ4fV1fMFu3BxhN3uhnfNAOP.ES8k5ufH.i5gqUam'),
  (1,'doctor','Dr. Demo Doctor H01 040','doctor.h01.040@govcare.test','GCD-H01-DOC-040','govcare-demo-network-v1:h01:doctor:040','DEMO-WARD-040','$2a$10$S/w.7hIndToAzk.pjC3I9uUuYkwEcRlH1aL8HX6wiRBcAblSPBmay'),
  (1,'doctor','Dr. Demo Doctor H01 041','doctor.h01.041@govcare.test','GCD-H01-DOC-041','govcare-demo-network-v1:h01:doctor:041','DEMO-WARD-041','$2a$10$rJBQWZ5pFanGsPYQD.wL1eM4KY3AQG8oXyJ/TgfpN7IU3/Hr.v/VS'),
  (1,'doctor','Dr. Demo Doctor H01 042','doctor.h01.042@govcare.test','GCD-H01-DOC-042','govcare-demo-network-v1:h01:doctor:042','DEMO-WARD-042','$2a$10$AIl4rRHzKZ2U/30Z04zkou/2d3SmiN3F5TH9l.On0huoSiJ1Zx6ku'),
  (1,'doctor','Dr. Demo Doctor H01 043','doctor.h01.043@govcare.test','GCD-H01-DOC-043','govcare-demo-network-v1:h01:doctor:043','DEMO-WARD-043','$2a$10$p.ZbV/59iQiLy9GgzLxnSeSEFh/i1Xd18XUINZ1.oaIR5h3DZTaGi'),
  (1,'doctor','Dr. Demo Doctor H01 044','doctor.h01.044@govcare.test','GCD-H01-DOC-044','govcare-demo-network-v1:h01:doctor:044','DEMO-WARD-044','$2a$10$6HXqGDLPKDCIP7DLPJ8QJeDx1/PvtK1fTjFXePohaxlAIKG7hV4e6'),
  (1,'doctor','Dr. Demo Doctor H01 045','doctor.h01.045@govcare.test','GCD-H01-DOC-045','govcare-demo-network-v1:h01:doctor:045','DEMO-WARD-045','$2a$10$dmEUdWGc9sLZ48C8aCo1HefI4r4TWp.X4lG6xk6jtBj1Z278RNzkK'),
  (1,'doctor','Dr. Demo Doctor H01 046','doctor.h01.046@govcare.test','GCD-H01-DOC-046','govcare-demo-network-v1:h01:doctor:046','DEMO-WARD-046','$2a$10$gezI61Jt3vFdRyznZ0RMouGhchKqntMekwtPLoaUH1ycYu9U7nxtW'),
  (1,'doctor','Dr. Demo Doctor H01 047','doctor.h01.047@govcare.test','GCD-H01-DOC-047','govcare-demo-network-v1:h01:doctor:047','DEMO-WARD-047','$2a$10$/7kSqXLxoB5ukYeZQe65yeitX6jK/IWfhCnEx2h0r.nW3JRIy6BSS'),
  (1,'doctor','Dr. Demo Doctor H01 048','doctor.h01.048@govcare.test','GCD-H01-DOC-048','govcare-demo-network-v1:h01:doctor:048','DEMO-WARD-048','$2a$10$TY7hNAM5hoJTOKrQqj6CyuzcI3LUC6jwNaqh1cyuBozrjWPMJBk1m'),
  (1,'doctor','Dr. Demo Doctor H01 049','doctor.h01.049@govcare.test','GCD-H01-DOC-049','govcare-demo-network-v1:h01:doctor:049','DEMO-WARD-049','$2a$10$KyFI2MxSc2eBzXjjQG4VVO9S26EynJKtxOLvoin.p.ieyFseHCiO6'),
  (1,'doctor','Dr. Demo Doctor H01 050','doctor.h01.050@govcare.test','GCD-H01-DOC-050','govcare-demo-network-v1:h01:doctor:050','DEMO-WARD-050','$2a$10$BhOhAD4gCDsXvu0vy3jwqOmOMNJT9B5fgiq8dQCP6gRiQJnAysQK.'),
  (1,'doctor','Dr. Demo Doctor H01 051','doctor.h01.051@govcare.test','GCD-H01-DOC-051','govcare-demo-network-v1:h01:doctor:051','DEMO-WARD-051','$2a$10$7vSwlIKUnp2wJ0V6GiLQ/.L7I5MhUMuBY5ZgTpk3vV6jC5klUdDge'),
  (1,'doctor','Dr. Demo Doctor H01 052','doctor.h01.052@govcare.test','GCD-H01-DOC-052','govcare-demo-network-v1:h01:doctor:052','DEMO-WARD-052','$2a$10$Ifgs656.fRw.v0FN0DJ9Z.mLrbtHq/fLIr2jhGL12EPROZNgz6Wgi'),
  (1,'doctor','Dr. Demo Doctor H01 053','doctor.h01.053@govcare.test','GCD-H01-DOC-053','govcare-demo-network-v1:h01:doctor:053','DEMO-WARD-053','$2a$10$9lqsAqTq8HQt4L4LscLJkunzMP8Dxae57HXZH72gmUHvbP8tZHhpu'),
  (1,'doctor','Dr. Demo Doctor H01 054','doctor.h01.054@govcare.test','GCD-H01-DOC-054','govcare-demo-network-v1:h01:doctor:054','DEMO-WARD-054','$2a$10$SgKR/XexjC9PKWU9avcWr.ONZnCZGHvmWdBmBdBPFbB6FM1nRNmi.'),
  (1,'doctor','Dr. Demo Doctor H01 055','doctor.h01.055@govcare.test','GCD-H01-DOC-055','govcare-demo-network-v1:h01:doctor:055','DEMO-WARD-055','$2a$10$ro8/Ru3.xbQROK8JnZC7luEYmuMGeGv//wG7RWAcPL2DVmgwwThja'),
  (1,'doctor','Dr. Demo Doctor H01 056','doctor.h01.056@govcare.test','GCD-H01-DOC-056','govcare-demo-network-v1:h01:doctor:056','DEMO-WARD-056','$2a$10$XWyVM1rxOhkYe36SA1iDI.lfM3Yi9ZdLD2TNple9fdBaIw8cLN8HK'),
  (1,'doctor','Dr. Demo Doctor H01 057','doctor.h01.057@govcare.test','GCD-H01-DOC-057','govcare-demo-network-v1:h01:doctor:057','DEMO-WARD-057','$2a$10$3tYh7TQGmt3m/fHZI4QrX.MAl/jH.qFkCghYXX1qghTXfZp53a5k.'),
  (1,'doctor','Dr. Demo Doctor H01 058','doctor.h01.058@govcare.test','GCD-H01-DOC-058','govcare-demo-network-v1:h01:doctor:058','DEMO-WARD-058','$2a$10$FmnO4Xh5gvONDix1qn0aMOIr.q3vxuc7rEXoX/TY4KFnz/SiRiMhO'),
  (1,'doctor','Dr. Demo Doctor H01 059','doctor.h01.059@govcare.test','GCD-H01-DOC-059','govcare-demo-network-v1:h01:doctor:059','DEMO-WARD-059','$2a$10$knw0qI9rAzMaJPwkz2ZaYuhPlodw8jy4IG9fP6oJuvv.sTbz5.VAu'),
  (1,'doctor','Dr. Demo Doctor H01 060','doctor.h01.060@govcare.test','GCD-H01-DOC-060','govcare-demo-network-v1:h01:doctor:060','DEMO-WARD-060','$2a$10$VP2.uWNoAjYx3yJzePHjg.IE0eV6elfwOTF0UJExPVwqm69Vex5tC'),
  (1,'doctor','Dr. Demo Doctor H01 061','doctor.h01.061@govcare.test','GCD-H01-DOC-061','govcare-demo-network-v1:h01:doctor:061','DEMO-WARD-061','$2a$10$LHvJWp/AcWGvzB6eV9Zkme2Rao/ulqs.F1udI2CoQgU8VffgCJyIe'),
  (1,'doctor','Dr. Demo Doctor H01 062','doctor.h01.062@govcare.test','GCD-H01-DOC-062','govcare-demo-network-v1:h01:doctor:062','DEMO-WARD-062','$2a$10$ZgttlfcTDnHFTDnsRjhm2uzZTQDDWafTzI53v0iEN.DhePYB3tgxO'),
  (1,'doctor','Dr. Demo Doctor H01 063','doctor.h01.063@govcare.test','GCD-H01-DOC-063','govcare-demo-network-v1:h01:doctor:063','DEMO-WARD-063','$2a$10$sfTZ.Dfl2k6RNkKEV6cmYeUUNdhlsvvLJ3EbGtZhk2wKZSPg6Lx1O'),
  (1,'doctor','Dr. Demo Doctor H01 064','doctor.h01.064@govcare.test','GCD-H01-DOC-064','govcare-demo-network-v1:h01:doctor:064','DEMO-WARD-064','$2a$10$vcKBbec0D6bLgwGLwtTMtecqZzBeAkeXvx0VtPBDug6UIz.a97tza'),
  (1,'doctor','Dr. Demo Doctor H01 065','doctor.h01.065@govcare.test','GCD-H01-DOC-065','govcare-demo-network-v1:h01:doctor:065','DEMO-WARD-065','$2a$10$uPtw4Om91myDJ3gsTyZvV.b/mK6UoW2AZP3kwzingBP7YjUzWI.t6'),
  (1,'doctor','Dr. Demo Doctor H01 066','doctor.h01.066@govcare.test','GCD-H01-DOC-066','govcare-demo-network-v1:h01:doctor:066','DEMO-WARD-066','$2a$10$IUt8Of4qW8rJV9sgJhGRduUekJ78Rc31/5iNYgoi9wBNZ3GBmFSwi'),
  (1,'doctor','Dr. Demo Doctor H01 067','doctor.h01.067@govcare.test','GCD-H01-DOC-067','govcare-demo-network-v1:h01:doctor:067','DEMO-WARD-067','$2a$10$KMbSwp.Q8Osg5FyqNfRwMORLDksOCH2rwO3SeZWQImOCABfjiikK2'),
  (1,'doctor','Dr. Demo Doctor H01 068','doctor.h01.068@govcare.test','GCD-H01-DOC-068','govcare-demo-network-v1:h01:doctor:068','DEMO-WARD-068','$2a$10$cg/D.YWw2g92Lh22/ihYbuf7pqTga9mjrq.mnuOisV9G6Cs.8sbri'),
  (1,'doctor','Dr. Demo Doctor H01 069','doctor.h01.069@govcare.test','GCD-H01-DOC-069','govcare-demo-network-v1:h01:doctor:069','DEMO-WARD-069','$2a$10$Fs2UvW14aP1.96CX/n.OjuQLUC9vLzKl5dCwN5MnELRMb255D/WFi'),
  (1,'doctor','Dr. Demo Doctor H01 070','doctor.h01.070@govcare.test','GCD-H01-DOC-070','govcare-demo-network-v1:h01:doctor:070','DEMO-WARD-070','$2a$10$SQDNkKGuwk.dQRWlGT.Fcumqft.pznbF6HrXskcilnLRfsbOw7mEq'),
  (1,'doctor','Dr. Demo Doctor H01 071','doctor.h01.071@govcare.test','GCD-H01-DOC-071','govcare-demo-network-v1:h01:doctor:071','DEMO-WARD-071','$2a$10$gR/j3KQyJY0XjzYWWiU/4eV8UtQGFcv8ciEJPvK6kctlf0MTKdCKq'),
  (1,'doctor','Dr. Demo Doctor H01 072','doctor.h01.072@govcare.test','GCD-H01-DOC-072','govcare-demo-network-v1:h01:doctor:072','DEMO-WARD-072','$2a$10$FoeEBPw7HKKRJpO8asizAe.IkXjCgNDJRofa9ISLqva8y4npiORTS'),
  (1,'doctor','Dr. Demo Doctor H01 073','doctor.h01.073@govcare.test','GCD-H01-DOC-073','govcare-demo-network-v1:h01:doctor:073','DEMO-WARD-073','$2a$10$xzjQJAAWNvNYAYBPEwtfWOBMGRJidl6dZflKOFN1rlqGz6bsv76CO'),
  (1,'doctor','Dr. Demo Doctor H01 074','doctor.h01.074@govcare.test','GCD-H01-DOC-074','govcare-demo-network-v1:h01:doctor:074','DEMO-WARD-074','$2a$10$qtANSuqYcmcechlhrpyr7eyiVnmHnLcgnEHAPhn0Nx./srbmtGwh6'),
  (1,'doctor','Dr. Demo Doctor H01 075','doctor.h01.075@govcare.test','GCD-H01-DOC-075','govcare-demo-network-v1:h01:doctor:075','DEMO-WARD-075','$2a$10$v00Bs9/vktw9JNjMeOD1mucRlTn1IPFqvIoBdMwR0mpz4ZOs1FoCG'),
  (1,'doctor','Dr. Demo Doctor H01 076','doctor.h01.076@govcare.test','GCD-H01-DOC-076','govcare-demo-network-v1:h01:doctor:076','DEMO-WARD-076','$2a$10$VGPKGt8TpcSewCawrMxkOOHj2cLbf8pSa7FjIy7OIw4nWL385ArFG'),
  (1,'doctor','Dr. Demo Doctor H01 077','doctor.h01.077@govcare.test','GCD-H01-DOC-077','govcare-demo-network-v1:h01:doctor:077','DEMO-WARD-077','$2a$10$/F/nwSBWjSJ4.R4GQ4Ln2eCBfFwBi7hvdvMhp1iOKiHe6h22UidZ2'),
  (1,'doctor','Dr. Demo Doctor H01 078','doctor.h01.078@govcare.test','GCD-H01-DOC-078','govcare-demo-network-v1:h01:doctor:078','DEMO-WARD-078','$2a$10$fNMBnHbBX/n.vPZrJOGTl.NPEiGuBo9UV68lXuxzRlhirian9g2dK'),
  (1,'doctor','Dr. Demo Doctor H01 079','doctor.h01.079@govcare.test','GCD-H01-DOC-079','govcare-demo-network-v1:h01:doctor:079','DEMO-WARD-079','$2a$10$UGf1wLurIomaiHWoNA4ZJuG6IHU1AlAhrfA868ik0SQFDDd//v8Fq'),
  (1,'doctor','Dr. Demo Doctor H01 080','doctor.h01.080@govcare.test','GCD-H01-DOC-080','govcare-demo-network-v1:h01:doctor:080','DEMO-WARD-080','$2a$10$N4q02jDre5qXPyOVLyDhE.O.GzFSqHymwAiyIo1Qs2PiE88JRrdH.'),
  (1,'doctor','Dr. Demo Doctor H01 081','doctor.h01.081@govcare.test','GCD-H01-DOC-081','govcare-demo-network-v1:h01:doctor:081','DEMO-WARD-081','$2a$10$lArFx5pDMwif/jc7KcPd8e5AedFQ5d5nT910aSBq5W7t12lfM9EuK'),
  (1,'doctor','Dr. Demo Doctor H01 082','doctor.h01.082@govcare.test','GCD-H01-DOC-082','govcare-demo-network-v1:h01:doctor:082','DEMO-WARD-082','$2a$10$hhrh2FT3iOEiXbhhX72m7ueM.Q5.d54Hqk3Kn65LGOzSMuWl1cbIG'),
  (1,'doctor','Dr. Demo Doctor H01 083','doctor.h01.083@govcare.test','GCD-H01-DOC-083','govcare-demo-network-v1:h01:doctor:083','DEMO-WARD-083','$2a$10$PsD5x43p6mEr.pJyMvW3gux3xLKI9mvB0OfGotPpJnpDZ7tBbFP1q'),
  (1,'doctor','Dr. Demo Doctor H01 084','doctor.h01.084@govcare.test','GCD-H01-DOC-084','govcare-demo-network-v1:h01:doctor:084','DEMO-WARD-084','$2a$10$RCwCVee2c/I59xAiF5n4eOoEXhunjV3rLrCS./f6JkhB5EMwWxBB2'),
  (1,'doctor','Dr. Demo Doctor H01 085','doctor.h01.085@govcare.test','GCD-H01-DOC-085','govcare-demo-network-v1:h01:doctor:085','DEMO-WARD-085','$2a$10$ClLm0ENNjq0tPibpov9R0./X1Pqjm//87QuWvkpqgFTvgMVJZHYhO'),
  (1,'doctor','Dr. Demo Doctor H01 086','doctor.h01.086@govcare.test','GCD-H01-DOC-086','govcare-demo-network-v1:h01:doctor:086','DEMO-WARD-086','$2a$10$3k0rd/zEEffX0UunI8h.fe3XQpVniDGTUZexqwmgD50PLMINFdCXK'),
  (1,'doctor','Dr. Demo Doctor H01 087','doctor.h01.087@govcare.test','GCD-H01-DOC-087','govcare-demo-network-v1:h01:doctor:087','DEMO-WARD-087','$2a$10$4EZYk8jUS0/fGvPPMZ1tnu0NRpaIuxlGPPToWD/0s1oWu4DxqWUdO'),
  (1,'doctor','Dr. Demo Doctor H01 088','doctor.h01.088@govcare.test','GCD-H01-DOC-088','govcare-demo-network-v1:h01:doctor:088','DEMO-WARD-088','$2a$10$KX6ks//PxZHODa3UBKrNQ.wtpq7vr2U4gPHRyASMg6vQcGW6BFybq'),
  (1,'doctor','Dr. Demo Doctor H01 089','doctor.h01.089@govcare.test','GCD-H01-DOC-089','govcare-demo-network-v1:h01:doctor:089','DEMO-WARD-089','$2a$10$CelhhqU/4jwMhiU8YWA/.eXhkc4PDfDvio74/.rBnTz38b4Q8qDau'),
  (1,'doctor','Dr. Demo Doctor H01 090','doctor.h01.090@govcare.test','GCD-H01-DOC-090','govcare-demo-network-v1:h01:doctor:090','DEMO-WARD-090','$2a$10$XvVPGiz9aB6VHRJEwlZfieVYxajFwLJH2jTysO0AhaTK4yjzc/mfq'),
  (1,'doctor','Dr. Demo Doctor H01 091','doctor.h01.091@govcare.test','GCD-H01-DOC-091','govcare-demo-network-v1:h01:doctor:091','DEMO-WARD-091','$2a$10$SBokbe427aPn9NAAXhNTIusAYeL3zrfXPIKagVAN5iLdFp6XmEvni'),
  (1,'doctor','Dr. Demo Doctor H01 092','doctor.h01.092@govcare.test','GCD-H01-DOC-092','govcare-demo-network-v1:h01:doctor:092','DEMO-WARD-092','$2a$10$O9Cz49zYTA/AdkwbBERW9OtXJ.dg6nq.wwoHODQd/QBPBvlwkFywS'),
  (1,'doctor','Dr. Demo Doctor H01 093','doctor.h01.093@govcare.test','GCD-H01-DOC-093','govcare-demo-network-v1:h01:doctor:093','DEMO-WARD-093','$2a$10$oHgw9/FAXuw/jQ.OHVFnAuUTy8/QWxx5cZO4TmRks3QBcYgsbGuJe'),
  (1,'doctor','Dr. Demo Doctor H01 094','doctor.h01.094@govcare.test','GCD-H01-DOC-094','govcare-demo-network-v1:h01:doctor:094','DEMO-WARD-094','$2a$10$AeDuMEPRJ7RT4KzjugPox.2v9ZHpTQ4.E/7sd3WemVabj2dJAnm5O'),
  (1,'doctor','Dr. Demo Doctor H01 095','doctor.h01.095@govcare.test','GCD-H01-DOC-095','govcare-demo-network-v1:h01:doctor:095','DEMO-WARD-095','$2a$10$uyegzqKr7YJDQpy3koKWhuMsxhkB5L0Vwy8T85t/8jcoaQD1DZnEe'),
  (1,'doctor','Dr. Demo Doctor H01 096','doctor.h01.096@govcare.test','GCD-H01-DOC-096','govcare-demo-network-v1:h01:doctor:096','DEMO-WARD-096','$2a$10$n2DJEmbSNi7X/ffLMF3xJet1TAditqZYPL7jAtvsEDBbT0aNzgVb.'),
  (1,'doctor','Dr. Demo Doctor H01 097','doctor.h01.097@govcare.test','GCD-H01-DOC-097','govcare-demo-network-v1:h01:doctor:097','DEMO-WARD-097','$2a$10$QveB8d5EBRWsj5WJno1LnOtLz7asEZuH49bZhuf/CqMBwNP0ylAvG'),
  (1,'doctor','Dr. Demo Doctor H01 098','doctor.h01.098@govcare.test','GCD-H01-DOC-098','govcare-demo-network-v1:h01:doctor:098','DEMO-WARD-098','$2a$10$oawJnrRB4DT.A1ATBxQZSO1H6f1Uc3/sISIDpjbnWy4kMWBQgK.IW'),
  (1,'doctor','Dr. Demo Doctor H01 099','doctor.h01.099@govcare.test','GCD-H01-DOC-099','govcare-demo-network-v1:h01:doctor:099','DEMO-WARD-099','$2a$10$8y2oY7NI.aDgq3MJ6bupS.HDfSjwynFHfvSC2.969kv/ZRYNHQlYK'),
  (1,'doctor','Dr. Demo Doctor H01 100','doctor.h01.100@govcare.test','GCD-H01-DOC-100','govcare-demo-network-v1:h01:doctor:100','DEMO-WARD-100','$2a$10$zye1SnZfuUxK5fFijDnq2.ts2wbx/SVL9VoB43xgOd0BS3VGHEw56'),
  (1,'hospital_admin','Demo Hospital Admin H01','admin.h01@govcare.test','GCD-H01-ADMIN','govcare-demo-network-v1:h01:hospital_admin','ADMIN','$2a$10$a7ezDGQcP2.Wsad9vFNO2uwJ9dPyLxrAw935ci97OY2FtK435i1n.'),
  (1,'receptionist','Demo Front Desk Officer H01','reception.h01@govcare.test','GCD-H01-RECEPTION','govcare-demo-network-v1:h01:receptionist','RECEPTION','$2a$10$5sJMzeTxcgmV0PDpQjHe7.072BNo4t1YXJRzAQdinZHaz.vF/fZV2'),
  (1,'nurse','Demo Nurse H01','nurse.h01@govcare.test','GCD-H01-NURSE','govcare-demo-network-v1:h01:nurse','DEMO-WARD-001','$2a$10$xcqXXXbCevHAWvBXCgL1xu5jtzmZ0.JS2sbH3yzQEJxtxAn0tUELq'),
  (1,'ward_manager','Demo Ward Manager H01','wardmanager.h01@govcare.test','GCD-H01-WARDMANAGER','govcare-demo-network-v1:h01:ward_manager','DEMO-WARD-001','$2a$10$noJpaRt6LJnlHGwGVEK6QefWpJT2nhtJcw5NsyiLQAa0C.O8REikG'),
  (1,'patient','Demo Patient Portal User H01','patient.h01@govcare.test','GCD-H01-PATIENT','govcare-demo-network-v1:h01:patient',null,'$2a$10$H7Bq3R/vdXSuUopTYmaxuOKOgseK7ZQStW/itJrE8F2k7pDiLEDL2'),
  (1,'guardian','Demo Guardian Portal User H01','guardian.h01@govcare.test','GCD-H01-GUARDIAN','govcare-demo-network-v1:h01:guardian',null,'$2a$10$Wvethn60unRk4pXlGOwCyuSbL1aHw4SzjPF/4uykYWEGH1mpTv2La'),
  (2,'doctor','Dr. Demo Doctor H02 001','doctor.h02.001@govcare.test','GCD-H02-DOC-001','govcare-demo-network-v1:h02:doctor:001','DEMO-WARD-001','$2a$10$H5d8c4.KnSjIfCJd3rordOSja0I3UqD3amBPgt/4/.jb7LGEj2OgC'),
  (2,'doctor','Dr. Demo Doctor H02 002','doctor.h02.002@govcare.test','GCD-H02-DOC-002','govcare-demo-network-v1:h02:doctor:002','DEMO-WARD-002','$2a$10$YC/yZEUMyUJa76jta9ly1.MLvcxrUO9hk0x0YGXyaQJCQqE.7xR2y'),
  (2,'doctor','Dr. Demo Doctor H02 003','doctor.h02.003@govcare.test','GCD-H02-DOC-003','govcare-demo-network-v1:h02:doctor:003','DEMO-WARD-003','$2a$10$dKhHcKsja2e.6SjvxZ/DienzJZ3HFQKL29TX.sb768.nChA9mnZDK'),
  (2,'doctor','Dr. Demo Doctor H02 004','doctor.h02.004@govcare.test','GCD-H02-DOC-004','govcare-demo-network-v1:h02:doctor:004','DEMO-WARD-004','$2a$10$jjytcwsHF4Wfdt7erxcNMOxKGpfR3njPJVBOeaWterJj0B6P1biki'),
  (2,'doctor','Dr. Demo Doctor H02 005','doctor.h02.005@govcare.test','GCD-H02-DOC-005','govcare-demo-network-v1:h02:doctor:005','DEMO-WARD-005','$2a$10$r97ODrkEt8a2jgxoxfJwj.K4.SW45oRKxg.emi/JK59v.qzicbKT.'),
  (2,'doctor','Dr. Demo Doctor H02 006','doctor.h02.006@govcare.test','GCD-H02-DOC-006','govcare-demo-network-v1:h02:doctor:006','DEMO-WARD-006','$2a$10$USzNbEklTJFMxwGqYhDhcegARsgg/tKYGfGhRFBNCOeKT7Vla/KC6'),
  (2,'doctor','Dr. Demo Doctor H02 007','doctor.h02.007@govcare.test','GCD-H02-DOC-007','govcare-demo-network-v1:h02:doctor:007','DEMO-WARD-007','$2a$10$9.9CtBJ6e7bsgm/tZ2Yjh.MBzpKwnjobQfpZq/uNJ0qitXi4G803O'),
  (2,'doctor','Dr. Demo Doctor H02 008','doctor.h02.008@govcare.test','GCD-H02-DOC-008','govcare-demo-network-v1:h02:doctor:008','DEMO-WARD-008','$2a$10$1OixAwjtvbkLYGDBUOeyTunAKltyo9VAxo8rAmdqFsQP4nl12SKn2'),
  (2,'doctor','Dr. Demo Doctor H02 009','doctor.h02.009@govcare.test','GCD-H02-DOC-009','govcare-demo-network-v1:h02:doctor:009','DEMO-WARD-009','$2a$10$vEGsVUkN15r4KdpA7HWJmOT7LXmptK0rtB7cz4s3a6C8upM58QOIe'),
  (2,'doctor','Dr. Demo Doctor H02 010','doctor.h02.010@govcare.test','GCD-H02-DOC-010','govcare-demo-network-v1:h02:doctor:010','DEMO-WARD-010','$2a$10$F6EXNdf.BoqiYhANobcEFeiXg7M1QNYGUxD.p6UtkPosfi3PEeXQO'),
  (2,'doctor','Dr. Demo Doctor H02 011','doctor.h02.011@govcare.test','GCD-H02-DOC-011','govcare-demo-network-v1:h02:doctor:011','DEMO-WARD-011','$2a$10$T.3h6bMzBSwNivG615VIHOTLP3kHDHPgd5VgDHQARzX2Vm6IQrpke'),
  (2,'doctor','Dr. Demo Doctor H02 012','doctor.h02.012@govcare.test','GCD-H02-DOC-012','govcare-demo-network-v1:h02:doctor:012','DEMO-WARD-012','$2a$10$TtzTsJhgjy7.J6.3HAkD7emCrOqBHSIjx8QrwzDhwT0e9V70Yo39G'),
  (2,'doctor','Dr. Demo Doctor H02 013','doctor.h02.013@govcare.test','GCD-H02-DOC-013','govcare-demo-network-v1:h02:doctor:013','DEMO-WARD-013','$2a$10$tS2dcK17HreAJhlbJhmr9OcOoV1aAqgemRhHb7ck6dkfF9PJbDkPm'),
  (2,'doctor','Dr. Demo Doctor H02 014','doctor.h02.014@govcare.test','GCD-H02-DOC-014','govcare-demo-network-v1:h02:doctor:014','DEMO-WARD-014','$2a$10$Qw/hn/jYfcx//SMLFwTueO5kAxRr2u4IyMQrZQv3j1HngenQziPba'),
  (2,'doctor','Dr. Demo Doctor H02 015','doctor.h02.015@govcare.test','GCD-H02-DOC-015','govcare-demo-network-v1:h02:doctor:015','DEMO-WARD-015','$2a$10$DA9fCS0.OSLz2gJHu6fFq.wTCh91AqN30ktrzbrGt/i3kbP.31cfu'),
  (2,'doctor','Dr. Demo Doctor H02 016','doctor.h02.016@govcare.test','GCD-H02-DOC-016','govcare-demo-network-v1:h02:doctor:016','DEMO-WARD-016','$2a$10$52CvgnCgBTM5Pa7i9fLrtuUEWmloWk/Sr4/DJ4IE7pYDWg.AL66iS'),
  (2,'doctor','Dr. Demo Doctor H02 017','doctor.h02.017@govcare.test','GCD-H02-DOC-017','govcare-demo-network-v1:h02:doctor:017','DEMO-WARD-017','$2a$10$hoNUYgOu3uc1/leo.tyatupFi0pzgUlWFTD67Ka9HxDRZFBQKnxYe'),
  (2,'doctor','Dr. Demo Doctor H02 018','doctor.h02.018@govcare.test','GCD-H02-DOC-018','govcare-demo-network-v1:h02:doctor:018','DEMO-WARD-018','$2a$10$2dBNuIpFvtDrGMcqYWjuA.fAdQeO1fH5Ti5bs4PJzQOkyWDfD3ZpK'),
  (2,'doctor','Dr. Demo Doctor H02 019','doctor.h02.019@govcare.test','GCD-H02-DOC-019','govcare-demo-network-v1:h02:doctor:019','DEMO-WARD-019','$2a$10$mpjaXSqqoc44vr1zwYk5se274V9Yx6cfNc7Bf.3oaV/HJFs6nPace'),
  (2,'doctor','Dr. Demo Doctor H02 020','doctor.h02.020@govcare.test','GCD-H02-DOC-020','govcare-demo-network-v1:h02:doctor:020','DEMO-WARD-020','$2a$10$tgEyFbLX71k/izYS1huUKeppSbYCPZtUpS4gbflkTLjQ76xjcfAbG'),
  (2,'doctor','Dr. Demo Doctor H02 021','doctor.h02.021@govcare.test','GCD-H02-DOC-021','govcare-demo-network-v1:h02:doctor:021','DEMO-WARD-021','$2a$10$DXHf3UFyTyAGS3oN4WmnXOagDW36FXDGfw/31BAIlJNjyx8x4ztyW'),
  (2,'doctor','Dr. Demo Doctor H02 022','doctor.h02.022@govcare.test','GCD-H02-DOC-022','govcare-demo-network-v1:h02:doctor:022','DEMO-WARD-022','$2a$10$fLEL.nqF95zka0nlUe58wOASvxsZjpKp1fo.PfkgXxxpjOooIw0J6'),
  (2,'doctor','Dr. Demo Doctor H02 023','doctor.h02.023@govcare.test','GCD-H02-DOC-023','govcare-demo-network-v1:h02:doctor:023','DEMO-WARD-023','$2a$10$pG/YAUY9z4Y/Az4gJ4RyguSqfjivXQA9pARbweCJr7TTee8FqS7uO'),
  (2,'doctor','Dr. Demo Doctor H02 024','doctor.h02.024@govcare.test','GCD-H02-DOC-024','govcare-demo-network-v1:h02:doctor:024','DEMO-WARD-024','$2a$10$NQMP06YjXXmT2StH.OmENOA/KQdfnkIvzB.HL.alJf/otWGe7BcyG'),
  (2,'doctor','Dr. Demo Doctor H02 025','doctor.h02.025@govcare.test','GCD-H02-DOC-025','govcare-demo-network-v1:h02:doctor:025','DEMO-WARD-025','$2a$10$wKrU7HA6xIN/7aM8uKzos.bCe8.H6FZ3GL9B7HXWwDwMv3iJMMRNu'),
  (2,'doctor','Dr. Demo Doctor H02 026','doctor.h02.026@govcare.test','GCD-H02-DOC-026','govcare-demo-network-v1:h02:doctor:026','DEMO-WARD-026','$2a$10$r0y/Zvyx3dSzrX1P19i7cOOGqAQLDI/dDUv.k2r8SxvoS2uDnVvAy'),
  (2,'doctor','Dr. Demo Doctor H02 027','doctor.h02.027@govcare.test','GCD-H02-DOC-027','govcare-demo-network-v1:h02:doctor:027','DEMO-WARD-027','$2a$10$uB6mC/qSNzN78pH4dy37MeiePZl2/C4BF8576qaaUI/zv6U3uektG'),
  (2,'doctor','Dr. Demo Doctor H02 028','doctor.h02.028@govcare.test','GCD-H02-DOC-028','govcare-demo-network-v1:h02:doctor:028','DEMO-WARD-028','$2a$10$fqK44.clIwcOHExMZ/XrW.BT/R7sUXH0Ofs6pULW9/9bpIAiwl5yG'),
  (2,'doctor','Dr. Demo Doctor H02 029','doctor.h02.029@govcare.test','GCD-H02-DOC-029','govcare-demo-network-v1:h02:doctor:029','DEMO-WARD-029','$2a$10$mxTDhHabhV7kptxSIk7ExuAVcUTw.Mf6buM6y0e2Pdm5GB2sxji5i'),
  (2,'doctor','Dr. Demo Doctor H02 030','doctor.h02.030@govcare.test','GCD-H02-DOC-030','govcare-demo-network-v1:h02:doctor:030','DEMO-WARD-030','$2a$10$l0v1tgv3Wv959lnix357g.EdO0/.B.OzvVanP3y9Gt1bCxn2bPJzC'),
  (2,'doctor','Dr. Demo Doctor H02 031','doctor.h02.031@govcare.test','GCD-H02-DOC-031','govcare-demo-network-v1:h02:doctor:031','DEMO-WARD-031','$2a$10$u8Q7i4bmh7MvMmCcAM35yOJ1LBD/xRAA/bhK7YmxsRTeV7i6FxE/6'),
  (2,'doctor','Dr. Demo Doctor H02 032','doctor.h02.032@govcare.test','GCD-H02-DOC-032','govcare-demo-network-v1:h02:doctor:032','DEMO-WARD-032','$2a$10$zxszk97t2gMkA2B3LV9Mt.cwV2kj8Y4NRXhR3kbAnNr/3nQEuiMaS'),
  (2,'doctor','Dr. Demo Doctor H02 033','doctor.h02.033@govcare.test','GCD-H02-DOC-033','govcare-demo-network-v1:h02:doctor:033','DEMO-WARD-033','$2a$10$afA//moBGsEqiAUgijjop./5OKhq38xdCZ4HUKVCxglhDgnJrbUTq'),
  (2,'doctor','Dr. Demo Doctor H02 034','doctor.h02.034@govcare.test','GCD-H02-DOC-034','govcare-demo-network-v1:h02:doctor:034','DEMO-WARD-034','$2a$10$UazO7MieXIQ0HqbJvggtN./xbAk9IW4FuVTu94PWm5ifRU0EcgV4e'),
  (2,'doctor','Dr. Demo Doctor H02 035','doctor.h02.035@govcare.test','GCD-H02-DOC-035','govcare-demo-network-v1:h02:doctor:035','DEMO-WARD-035','$2a$10$Lpt.lvCaueuxt3raAgYu4OKTwsNeqt5dlNmnJYjNZCEwup5NzM04K'),
  (2,'doctor','Dr. Demo Doctor H02 036','doctor.h02.036@govcare.test','GCD-H02-DOC-036','govcare-demo-network-v1:h02:doctor:036','DEMO-WARD-036','$2a$10$PwmMonjcy/bna5GkiZ9sfOwsJ80PvbTTQjWuAcMkEcjR4AlDdruGC'),
  (2,'doctor','Dr. Demo Doctor H02 037','doctor.h02.037@govcare.test','GCD-H02-DOC-037','govcare-demo-network-v1:h02:doctor:037','DEMO-WARD-037','$2a$10$rLeMbmK5i61i0pe5eAM8DOnfDJovdjjuE9tJpl4wh5cAjaVmo7CLK'),
  (2,'doctor','Dr. Demo Doctor H02 038','doctor.h02.038@govcare.test','GCD-H02-DOC-038','govcare-demo-network-v1:h02:doctor:038','DEMO-WARD-038','$2a$10$Z65fvCN.bxiE97yB4BW4We3oZoozod1PyDqzSgL99LzGSggeW6zZ2'),
  (2,'doctor','Dr. Demo Doctor H02 039','doctor.h02.039@govcare.test','GCD-H02-DOC-039','govcare-demo-network-v1:h02:doctor:039','DEMO-WARD-039','$2a$10$F0UcdcEUAUVL/zAdCyp/6uZJxVi2IysSEJK1ZVt1qCEOOLs/ENBGa'),
  (2,'doctor','Dr. Demo Doctor H02 040','doctor.h02.040@govcare.test','GCD-H02-DOC-040','govcare-demo-network-v1:h02:doctor:040','DEMO-WARD-040','$2a$10$9K8LM9t3Jl5f9I0PI.rNQuFQZppIPIGhfHnZUvWNHKddyuJmx3w52'),
  (2,'doctor','Dr. Demo Doctor H02 041','doctor.h02.041@govcare.test','GCD-H02-DOC-041','govcare-demo-network-v1:h02:doctor:041','DEMO-WARD-041','$2a$10$xQiAAtcuZtmTevpsmNJ9C.C2ey/0xjJ3omJbrQLZruJQhwp.6W81O'),
  (2,'doctor','Dr. Demo Doctor H02 042','doctor.h02.042@govcare.test','GCD-H02-DOC-042','govcare-demo-network-v1:h02:doctor:042','DEMO-WARD-042','$2a$10$c53Uxgz1SmgPdJtu7kmPG.oyEqdWZP4TrRcPVGTvnMUH7fFz5yx6y'),
  (2,'doctor','Dr. Demo Doctor H02 043','doctor.h02.043@govcare.test','GCD-H02-DOC-043','govcare-demo-network-v1:h02:doctor:043','DEMO-WARD-043','$2a$10$BvG2NCt9.dp8GWSJjY8zP.hawpYuMMeCFkkDnU.Cus8VVY37k6ZJK'),
  (2,'doctor','Dr. Demo Doctor H02 044','doctor.h02.044@govcare.test','GCD-H02-DOC-044','govcare-demo-network-v1:h02:doctor:044','DEMO-WARD-044','$2a$10$5nVBUjXjXgMapkbsWzoLPed02VRrirgi/iMA7Nv8sbaWTUTaXFUBO'),
  (2,'doctor','Dr. Demo Doctor H02 045','doctor.h02.045@govcare.test','GCD-H02-DOC-045','govcare-demo-network-v1:h02:doctor:045','DEMO-WARD-045','$2a$10$QAR1EJlhgG2k6aj1Eg/V.Oo0TrorGg7ZMH3cZx/.HHy6yOQcySF2.'),
  (2,'doctor','Dr. Demo Doctor H02 046','doctor.h02.046@govcare.test','GCD-H02-DOC-046','govcare-demo-network-v1:h02:doctor:046','DEMO-WARD-046','$2a$10$ZRpq6yv.C1TJRh3Mo7xfne4cgL3yK79k/IEHuOr/OyhTnB2kOURpm'),
  (2,'doctor','Dr. Demo Doctor H02 047','doctor.h02.047@govcare.test','GCD-H02-DOC-047','govcare-demo-network-v1:h02:doctor:047','DEMO-WARD-047','$2a$10$bfrxS.TLj/59mQxeZg.sBuX9GMRT5Jmw3rKjE53OfTFC5FshUQNWC'),
  (2,'doctor','Dr. Demo Doctor H02 048','doctor.h02.048@govcare.test','GCD-H02-DOC-048','govcare-demo-network-v1:h02:doctor:048','DEMO-WARD-048','$2a$10$U1ryaDv6cthgieM56VlJaeb1HRcYhVI4B9f1IJU7uilG8RPqEXZ3m'),
  (2,'doctor','Dr. Demo Doctor H02 049','doctor.h02.049@govcare.test','GCD-H02-DOC-049','govcare-demo-network-v1:h02:doctor:049','DEMO-WARD-049','$2a$10$UvlAv746j0R7umj5U70uGeGRuoXwpR6TLvxmObEt3M/WDJsF4gjKm'),
  (2,'doctor','Dr. Demo Doctor H02 050','doctor.h02.050@govcare.test','GCD-H02-DOC-050','govcare-demo-network-v1:h02:doctor:050','DEMO-WARD-050','$2a$10$pbDHVe7fJf9KikTkHHyYOOxIdM4X2Qytrtmi.SJGXsjUScsz8DwUK'),
  (2,'doctor','Dr. Demo Doctor H02 051','doctor.h02.051@govcare.test','GCD-H02-DOC-051','govcare-demo-network-v1:h02:doctor:051','DEMO-WARD-051','$2a$10$uZsRf2E.ohs1IsNSSYIZC.vLFtBgBTtoQFBQMvO35.Lr0S5/hHFLa'),
  (2,'doctor','Dr. Demo Doctor H02 052','doctor.h02.052@govcare.test','GCD-H02-DOC-052','govcare-demo-network-v1:h02:doctor:052','DEMO-WARD-052','$2a$10$B1TTWZnoJ7F0enr4LHWKd..nU8Dx3mq6uIz7V5Hs.PGr96jr9mh8u'),
  (2,'doctor','Dr. Demo Doctor H02 053','doctor.h02.053@govcare.test','GCD-H02-DOC-053','govcare-demo-network-v1:h02:doctor:053','DEMO-WARD-053','$2a$10$sO/SKfcKI3pX9imamYBlQuIYvBvabuLhKFATLuX/Ixn2rdd93KBsq'),
  (2,'doctor','Dr. Demo Doctor H02 054','doctor.h02.054@govcare.test','GCD-H02-DOC-054','govcare-demo-network-v1:h02:doctor:054','DEMO-WARD-054','$2a$10$I/E4rck/TnftUT72s08XBe9QQaTg9to07YFDfTSGK4Ce7wFqIQwXi'),
  (2,'doctor','Dr. Demo Doctor H02 055','doctor.h02.055@govcare.test','GCD-H02-DOC-055','govcare-demo-network-v1:h02:doctor:055','DEMO-WARD-055','$2a$10$/WAvfFvqy2F30XyXXiIud.1qm5ExR.OiB/rBW1SIufWxTaJ2QbG62'),
  (2,'doctor','Dr. Demo Doctor H02 056','doctor.h02.056@govcare.test','GCD-H02-DOC-056','govcare-demo-network-v1:h02:doctor:056','DEMO-WARD-056','$2a$10$G9nLNGtOFHmUsh.bq/CHmuNkFfjRIFUCd/b9g2pynv6SyhHXZMwt.'),
  (2,'doctor','Dr. Demo Doctor H02 057','doctor.h02.057@govcare.test','GCD-H02-DOC-057','govcare-demo-network-v1:h02:doctor:057','DEMO-WARD-057','$2a$10$iwW.YUf9E0A9qbVN6rRypeFkUqEjOdCNFZF33ycccaazAiIYvttU6'),
  (2,'doctor','Dr. Demo Doctor H02 058','doctor.h02.058@govcare.test','GCD-H02-DOC-058','govcare-demo-network-v1:h02:doctor:058','DEMO-WARD-058','$2a$10$HkFNF6iN8QdfJiSnWFWxW.B5i2Px/dVqxW8rFBepuf.kNAUBBTkN2'),
  (2,'doctor','Dr. Demo Doctor H02 059','doctor.h02.059@govcare.test','GCD-H02-DOC-059','govcare-demo-network-v1:h02:doctor:059','DEMO-WARD-059','$2a$10$qw5JvPcuRqGRYdlcXdOCHeuCvKGeh6s3t7wgO2V93m34Kd8vz6K6q'),
  (2,'doctor','Dr. Demo Doctor H02 060','doctor.h02.060@govcare.test','GCD-H02-DOC-060','govcare-demo-network-v1:h02:doctor:060','DEMO-WARD-060','$2a$10$VmzaD6oGR7VhClrVxOKPI.mLi7IcH39auW/PBH7G6xIiOlXejJ2Uu'),
  (2,'doctor','Dr. Demo Doctor H02 061','doctor.h02.061@govcare.test','GCD-H02-DOC-061','govcare-demo-network-v1:h02:doctor:061','DEMO-WARD-061','$2a$10$09iDl08h3xcula7GhJr2.OUJIeYIutwtMmXMIB5iA/zoO3PsUP2BK'),
  (2,'doctor','Dr. Demo Doctor H02 062','doctor.h02.062@govcare.test','GCD-H02-DOC-062','govcare-demo-network-v1:h02:doctor:062','DEMO-WARD-062','$2a$10$pQC1VPNj/TpqjfdErc8g6exu1QuN.pT1i/JKSjHJW.dDNDM5iVHcO'),
  (2,'doctor','Dr. Demo Doctor H02 063','doctor.h02.063@govcare.test','GCD-H02-DOC-063','govcare-demo-network-v1:h02:doctor:063','DEMO-WARD-063','$2a$10$dJ6cvTjiiZAw3tsvzbiug.Pyvb6BLQwiA6fINXHIW1TRMivWlN8OG'),
  (2,'doctor','Dr. Demo Doctor H02 064','doctor.h02.064@govcare.test','GCD-H02-DOC-064','govcare-demo-network-v1:h02:doctor:064','DEMO-WARD-064','$2a$10$Q2qWMlRmcuJflLoVcwQsOukQn/OayFmjY923xuW3vj4q/lBcmpnOG'),
  (2,'doctor','Dr. Demo Doctor H02 065','doctor.h02.065@govcare.test','GCD-H02-DOC-065','govcare-demo-network-v1:h02:doctor:065','DEMO-WARD-065','$2a$10$KdESoC1eTrAmdkbIvzaG0OPxR9mKrBGvde..N0noIkvvIkQpRd3NC'),
  (2,'doctor','Dr. Demo Doctor H02 066','doctor.h02.066@govcare.test','GCD-H02-DOC-066','govcare-demo-network-v1:h02:doctor:066','DEMO-WARD-066','$2a$10$e6j4UexL6Fjnlk6tTx4mqOjm8kjCrJOwp.dGSec24QewH4dae89GW'),
  (2,'doctor','Dr. Demo Doctor H02 067','doctor.h02.067@govcare.test','GCD-H02-DOC-067','govcare-demo-network-v1:h02:doctor:067','DEMO-WARD-067','$2a$10$eUndaavJLetq/YftpN3sTOKCgeI3YVjM7ADfl5WhZY31x/zryM0QO'),
  (2,'doctor','Dr. Demo Doctor H02 068','doctor.h02.068@govcare.test','GCD-H02-DOC-068','govcare-demo-network-v1:h02:doctor:068','DEMO-WARD-068','$2a$10$TLqHJSPE1TyzOVCjK.SBVe0QpepScJKaKxgnG3XGK10rHbmItRYF2'),
  (2,'doctor','Dr. Demo Doctor H02 069','doctor.h02.069@govcare.test','GCD-H02-DOC-069','govcare-demo-network-v1:h02:doctor:069','DEMO-WARD-069','$2a$10$BShvlpifEIFZv5MdcRYhUufzWE4DSB2NL33E7Wpu8oGuSRjxdFx9O'),
  (2,'doctor','Dr. Demo Doctor H02 070','doctor.h02.070@govcare.test','GCD-H02-DOC-070','govcare-demo-network-v1:h02:doctor:070','DEMO-WARD-070','$2a$10$7G2fDsXij5QApDEH4Z3VHez9Fs2AnC8gymDM0sphBqyCHuNmN9jlu'),
  (2,'doctor','Dr. Demo Doctor H02 071','doctor.h02.071@govcare.test','GCD-H02-DOC-071','govcare-demo-network-v1:h02:doctor:071','DEMO-WARD-071','$2a$10$vixhImDK4grWtT1QoOvL9u5GFu.YnZF5K9HOYZ3yTM5GJg5iTopjy'),
  (2,'doctor','Dr. Demo Doctor H02 072','doctor.h02.072@govcare.test','GCD-H02-DOC-072','govcare-demo-network-v1:h02:doctor:072','DEMO-WARD-072','$2a$10$bZwliTb6YySLwKoxyHiUmOIIGPdq9RYBZwHXjfhQc4mlvd3Oh3/S6'),
  (2,'doctor','Dr. Demo Doctor H02 073','doctor.h02.073@govcare.test','GCD-H02-DOC-073','govcare-demo-network-v1:h02:doctor:073','DEMO-WARD-073','$2a$10$aokyGgHv7sUT07sIriBvgu0TpAUtDsJx5P2NZ2ag9wKcrC7G7fxKW'),
  (2,'doctor','Dr. Demo Doctor H02 074','doctor.h02.074@govcare.test','GCD-H02-DOC-074','govcare-demo-network-v1:h02:doctor:074','DEMO-WARD-074','$2a$10$Led4815BbduHg3XOyK1dGuAnaAPGHdpQ7cee9nEL0gECOXsRARMcy'),
  (2,'doctor','Dr. Demo Doctor H02 075','doctor.h02.075@govcare.test','GCD-H02-DOC-075','govcare-demo-network-v1:h02:doctor:075','DEMO-WARD-075','$2a$10$A9rPi1sTk2cLJ2GKc8FOSufi8MkjfMkCFYYfS3hHU2fdbOB7HjOQS'),
  (2,'doctor','Dr. Demo Doctor H02 076','doctor.h02.076@govcare.test','GCD-H02-DOC-076','govcare-demo-network-v1:h02:doctor:076','DEMO-WARD-076','$2a$10$33mYZYSOV5ZGZyTkAQ6RpunCkj8mf7C0Ij0A8TzOrOBAMokL.nh2C'),
  (2,'doctor','Dr. Demo Doctor H02 077','doctor.h02.077@govcare.test','GCD-H02-DOC-077','govcare-demo-network-v1:h02:doctor:077','DEMO-WARD-077','$2a$10$CCslXqcOsOtLYn4pZJXQrefJysfy24Xii6XqxCtHAQY.iQuZkLz0m'),
  (2,'doctor','Dr. Demo Doctor H02 078','doctor.h02.078@govcare.test','GCD-H02-DOC-078','govcare-demo-network-v1:h02:doctor:078','DEMO-WARD-078','$2a$10$.sSmuLNMzjLprRGJqbVASunb7AEGBbgQlXFdbnOyXksdd3t8dtzXi'),
  (2,'doctor','Dr. Demo Doctor H02 079','doctor.h02.079@govcare.test','GCD-H02-DOC-079','govcare-demo-network-v1:h02:doctor:079','DEMO-WARD-079','$2a$10$5dNTul7XnVfPuPa2MpE.2.ybwNuPFKVVulA2YCYkT97CMe9Nw6Id2'),
  (2,'doctor','Dr. Demo Doctor H02 080','doctor.h02.080@govcare.test','GCD-H02-DOC-080','govcare-demo-network-v1:h02:doctor:080','DEMO-WARD-080','$2a$10$qUV97hSvgbmmF/wVHxvBoeRonGSLpWZaX16OJC5sJE8Caiw1xXr.S'),
  (2,'doctor','Dr. Demo Doctor H02 081','doctor.h02.081@govcare.test','GCD-H02-DOC-081','govcare-demo-network-v1:h02:doctor:081','DEMO-WARD-081','$2a$10$/E5zG1F7c1ICmlBfvwQ6cOhdmMMHUXGrNfXWVAK1KpP2pCpXSRrGS'),
  (2,'doctor','Dr. Demo Doctor H02 082','doctor.h02.082@govcare.test','GCD-H02-DOC-082','govcare-demo-network-v1:h02:doctor:082','DEMO-WARD-082','$2a$10$WdXH68vPFxyEZ/OOoakPFOLh/LHX.Vz9AN4Xd16YP90bd0hwusXB.'),
  (2,'doctor','Dr. Demo Doctor H02 083','doctor.h02.083@govcare.test','GCD-H02-DOC-083','govcare-demo-network-v1:h02:doctor:083','DEMO-WARD-083','$2a$10$dqfbSUPlMJiEeSbF2nYdFOb/GiOLjurm3vcbVSEPkAWaw2ryK9AQi'),
  (2,'doctor','Dr. Demo Doctor H02 084','doctor.h02.084@govcare.test','GCD-H02-DOC-084','govcare-demo-network-v1:h02:doctor:084','DEMO-WARD-084','$2a$10$Wm8EFZUtPGV4WeZL8ucUKu3XWMpuylzpLxSl0tCcVB83lBa150sN.'),
  (2,'doctor','Dr. Demo Doctor H02 085','doctor.h02.085@govcare.test','GCD-H02-DOC-085','govcare-demo-network-v1:h02:doctor:085','DEMO-WARD-085','$2a$10$afhPuucKEroXOQj5kl913OeMnbl8fGcLQFmBWnOnhbju59VPWIU7a'),
  (2,'doctor','Dr. Demo Doctor H02 086','doctor.h02.086@govcare.test','GCD-H02-DOC-086','govcare-demo-network-v1:h02:doctor:086','DEMO-WARD-086','$2a$10$rWBROpVZkg2fHyNdcBQiQ.dvMFm1zssJG2I47lQ66nScYEq4YCc9u'),
  (2,'doctor','Dr. Demo Doctor H02 087','doctor.h02.087@govcare.test','GCD-H02-DOC-087','govcare-demo-network-v1:h02:doctor:087','DEMO-WARD-087','$2a$10$DFTCVzrXejtSFswfvlZ2R.S7YEdPMy0xDlmLG3Uvjs8dd0MbwC9xm'),
  (2,'doctor','Dr. Demo Doctor H02 088','doctor.h02.088@govcare.test','GCD-H02-DOC-088','govcare-demo-network-v1:h02:doctor:088','DEMO-WARD-088','$2a$10$fyZALk/wP.cq6wrXheaGEuTVv/U12hvh8X9ED34iz9EKPobtMiY.C'),
  (2,'doctor','Dr. Demo Doctor H02 089','doctor.h02.089@govcare.test','GCD-H02-DOC-089','govcare-demo-network-v1:h02:doctor:089','DEMO-WARD-089','$2a$10$l5gXsWnHWxHWf4nF3ku/eet46yIZGeVyA/dYPJnDiwk.dGu7KNlty'),
  (2,'doctor','Dr. Demo Doctor H02 090','doctor.h02.090@govcare.test','GCD-H02-DOC-090','govcare-demo-network-v1:h02:doctor:090','DEMO-WARD-090','$2a$10$x3VA3oUv.KeeIuWiQZUB4eWu8LB47njv/2wtoHOYUB2GYmobyF8wa'),
  (2,'doctor','Dr. Demo Doctor H02 091','doctor.h02.091@govcare.test','GCD-H02-DOC-091','govcare-demo-network-v1:h02:doctor:091','DEMO-WARD-091','$2a$10$E.3w8wdAHgw/xX8bzmx/lOx71jtLXH8AYaquSmsHKk5JjHPqetiaG'),
  (2,'doctor','Dr. Demo Doctor H02 092','doctor.h02.092@govcare.test','GCD-H02-DOC-092','govcare-demo-network-v1:h02:doctor:092','DEMO-WARD-092','$2a$10$xU1ZWkhfSHjINXeZ3rgcuOqvjlT3uABVqF5I.xWPHS9PCOeDnlVKm'),
  (2,'doctor','Dr. Demo Doctor H02 093','doctor.h02.093@govcare.test','GCD-H02-DOC-093','govcare-demo-network-v1:h02:doctor:093','DEMO-WARD-093','$2a$10$oNyLMjOlSZ9nSL8rdsZ9ouqP4fFGKIB20iN74vBT1SgIzJH8LJ/GW'),
  (2,'doctor','Dr. Demo Doctor H02 094','doctor.h02.094@govcare.test','GCD-H02-DOC-094','govcare-demo-network-v1:h02:doctor:094','DEMO-WARD-094','$2a$10$H2FpQ3hUts0rucNIWjh3Pe3CvCLjgMaMIz6RySiimd7/7HzOlzUt2'),
  (2,'doctor','Dr. Demo Doctor H02 095','doctor.h02.095@govcare.test','GCD-H02-DOC-095','govcare-demo-network-v1:h02:doctor:095','DEMO-WARD-095','$2a$10$29HGDzvw.QiCvPrqg8eznuFJC.ookkde8jBxj3v2tjKPX7nyQ1.Ja'),
  (2,'doctor','Dr. Demo Doctor H02 096','doctor.h02.096@govcare.test','GCD-H02-DOC-096','govcare-demo-network-v1:h02:doctor:096','DEMO-WARD-096','$2a$10$paZzGX4k3SSH2PfDKBC5kOl5pKvqCDcwfvjTbjxQw/FfjGKfH7N7G'),
  (2,'doctor','Dr. Demo Doctor H02 097','doctor.h02.097@govcare.test','GCD-H02-DOC-097','govcare-demo-network-v1:h02:doctor:097','DEMO-WARD-097','$2a$10$nJIYFDb01K2CP36G2zkqoeU1uDlzVGLCMsQZShHEzqt3T4uljRgAK'),
  (2,'doctor','Dr. Demo Doctor H02 098','doctor.h02.098@govcare.test','GCD-H02-DOC-098','govcare-demo-network-v1:h02:doctor:098','DEMO-WARD-098','$2a$10$Bh.ApPpr/sFLqrioBtmUP.wvM4bd7Yx5nvEzZHYMqiEBwqGXYE9R6'),
  (2,'doctor','Dr. Demo Doctor H02 099','doctor.h02.099@govcare.test','GCD-H02-DOC-099','govcare-demo-network-v1:h02:doctor:099','DEMO-WARD-099','$2a$10$fUH4tla6uScjopS6ofzO5u.taISV.QYS5Q2r6B6X/xAgpcayiu.xy'),
  (2,'doctor','Dr. Demo Doctor H02 100','doctor.h02.100@govcare.test','GCD-H02-DOC-100','govcare-demo-network-v1:h02:doctor:100','DEMO-WARD-100','$2a$10$sQIuBq.PzRdVdAkSfSyYgeNvrSz7DzlJc/.EMg/py5O.uiV7H0SaG'),
  (2,'hospital_admin','Demo Hospital Admin H02','admin.h02@govcare.test','GCD-H02-ADMIN','govcare-demo-network-v1:h02:hospital_admin','ADMIN','$2a$10$iP0JzXVYP99T2qvRdKhLSOytlPep4em1r2HxuVMDEO1Jc9..fN3cq'),
  (2,'receptionist','Demo Front Desk Officer H02','reception.h02@govcare.test','GCD-H02-RECEPTION','govcare-demo-network-v1:h02:receptionist','RECEPTION','$2a$10$SfgnQXzWG0ZMSCIEmoh53OzMd4aX/TaZo50EU6XXWzy5zd40lC5Iq'),
  (2,'nurse','Demo Nurse H02','nurse.h02@govcare.test','GCD-H02-NURSE','govcare-demo-network-v1:h02:nurse','DEMO-WARD-001','$2a$10$gA5lWX3/LrrmOFadSKB3UOYeJ2P04unqYvRHU.2M6alZYwtxrHeWm'),
  (2,'ward_manager','Demo Ward Manager H02','wardmanager.h02@govcare.test','GCD-H02-WARDMANAGER','govcare-demo-network-v1:h02:ward_manager','DEMO-WARD-001','$2a$10$l6L0HGQdexA3GrjcranOCOCuaM8XSEOb3u6HaEtiR8sRKUHb739Dm'),
  (2,'patient','Demo Patient Portal User H02','patient.h02@govcare.test','GCD-H02-PATIENT','govcare-demo-network-v1:h02:patient',null,'$2a$10$HTDE090uKYBnjlRXy01gmOyFKpFBoLwGv85rsIjxExulnLf3aZnoi'),
  (2,'guardian','Demo Guardian Portal User H02','guardian.h02@govcare.test','GCD-H02-GUARDIAN','govcare-demo-network-v1:h02:guardian',null,'$2a$10$smP.qVZ6o8qDKp.7Fz5Oh.883YxERqFLIwCcTeNPudDUbIBH4tB0C'),
  (3,'doctor','Dr. Demo Doctor H03 001','doctor.h03.001@govcare.test','GCD-H03-DOC-001','govcare-demo-network-v1:h03:doctor:001','DEMO-WARD-001','$2a$10$nxVZDDMN1SvzMfJdY14QBuaDBF5.cBN6oKqEHBoEQ7sqGDFjir5jW'),
  (3,'doctor','Dr. Demo Doctor H03 002','doctor.h03.002@govcare.test','GCD-H03-DOC-002','govcare-demo-network-v1:h03:doctor:002','DEMO-WARD-002','$2a$10$sWxTxVAsB4d9Lux.OdLpZefeMiWzR6hsaq2Z/zGuEOM6JDf/7ISFy'),
  (3,'doctor','Dr. Demo Doctor H03 003','doctor.h03.003@govcare.test','GCD-H03-DOC-003','govcare-demo-network-v1:h03:doctor:003','DEMO-WARD-003','$2a$10$CyGkWA05p6HRM6.QPZcFL.L51ae4BNcDDxKGQnZQbcZ7a0Wftislu'),
  (3,'doctor','Dr. Demo Doctor H03 004','doctor.h03.004@govcare.test','GCD-H03-DOC-004','govcare-demo-network-v1:h03:doctor:004','DEMO-WARD-004','$2a$10$H98L7g5vzy.Dfj06dgJ4TelU736CFvsZ8NxtsRugJVWaz.clC2/7e'),
  (3,'doctor','Dr. Demo Doctor H03 005','doctor.h03.005@govcare.test','GCD-H03-DOC-005','govcare-demo-network-v1:h03:doctor:005','DEMO-WARD-005','$2a$10$Mew.txSoasP2cjmRVCQ9tuwbEURMJ51I6wpk8Sge.hlx.UKTpRBTW'),
  (3,'doctor','Dr. Demo Doctor H03 006','doctor.h03.006@govcare.test','GCD-H03-DOC-006','govcare-demo-network-v1:h03:doctor:006','DEMO-WARD-006','$2a$10$p2aOu0XFJdMvdyUjrgUd6.yv7Nt2yiGEiIpts3xWbmHtk4Dv1ckgu'),
  (3,'doctor','Dr. Demo Doctor H03 007','doctor.h03.007@govcare.test','GCD-H03-DOC-007','govcare-demo-network-v1:h03:doctor:007','DEMO-WARD-007','$2a$10$O.9l2h/ofLwDa5EtYVYUTu95ZzQy3t2BS73e/PPs2nxd3JnwlfpK2'),
  (3,'doctor','Dr. Demo Doctor H03 008','doctor.h03.008@govcare.test','GCD-H03-DOC-008','govcare-demo-network-v1:h03:doctor:008','DEMO-WARD-008','$2a$10$nJpexmvWI.wOVYgOmcVP7.CegG.si9lE045E0pPm.mrdjxOA8eVOW'),
  (3,'doctor','Dr. Demo Doctor H03 009','doctor.h03.009@govcare.test','GCD-H03-DOC-009','govcare-demo-network-v1:h03:doctor:009','DEMO-WARD-009','$2a$10$ZfAe8LViEC5SU0QE5EaCE.QHJWb5Kjd8irBaqZhz1jC1IWWVezLY2'),
  (3,'doctor','Dr. Demo Doctor H03 010','doctor.h03.010@govcare.test','GCD-H03-DOC-010','govcare-demo-network-v1:h03:doctor:010','DEMO-WARD-010','$2a$10$eaqdCuVMaXuELB1mMWUhLOjr8epTyoV0al3q010wmWoDanszY4WhC'),
  (3,'doctor','Dr. Demo Doctor H03 011','doctor.h03.011@govcare.test','GCD-H03-DOC-011','govcare-demo-network-v1:h03:doctor:011','DEMO-WARD-011','$2a$10$AACGkilTSO.4rxyf3Hmq7u2wzRT3ldKUYn3.QSUEoIHJDxPPdMTI.'),
  (3,'doctor','Dr. Demo Doctor H03 012','doctor.h03.012@govcare.test','GCD-H03-DOC-012','govcare-demo-network-v1:h03:doctor:012','DEMO-WARD-012','$2a$10$g4OkqHc6Orgm1RLarx5jxOklJ6nOIjeLJMtQ2.ae/xFKxEsnrByyq'),
  (3,'doctor','Dr. Demo Doctor H03 013','doctor.h03.013@govcare.test','GCD-H03-DOC-013','govcare-demo-network-v1:h03:doctor:013','DEMO-WARD-013','$2a$10$6ceFSENE/8qVCpkmE1N7YefbgnszF19WgTgH3umBfHu7SrKN2Iaxu'),
  (3,'doctor','Dr. Demo Doctor H03 014','doctor.h03.014@govcare.test','GCD-H03-DOC-014','govcare-demo-network-v1:h03:doctor:014','DEMO-WARD-014','$2a$10$tNKqfZybef04CzuBWJ03H.V//H8OnP3PiBc9DuVedSsTUrsUZigb6'),
  (3,'doctor','Dr. Demo Doctor H03 015','doctor.h03.015@govcare.test','GCD-H03-DOC-015','govcare-demo-network-v1:h03:doctor:015','DEMO-WARD-015','$2a$10$EtS932B4Jd8BCebqwtNb7Okm3aaUYsYzLOBwcg3r0HXysPZmxHumq'),
  (3,'doctor','Dr. Demo Doctor H03 016','doctor.h03.016@govcare.test','GCD-H03-DOC-016','govcare-demo-network-v1:h03:doctor:016','DEMO-WARD-016','$2a$10$AYqqvaaqymkbomlx1QnCqeV21lN.OaT34TgVOMs1DeTx8OI9TF85O'),
  (3,'doctor','Dr. Demo Doctor H03 017','doctor.h03.017@govcare.test','GCD-H03-DOC-017','govcare-demo-network-v1:h03:doctor:017','DEMO-WARD-017','$2a$10$FjCnlRwhdJ3W5il8CgdwWOQ0aX7SdkmXcdwgy/CtEwrwwPhOpDWUy'),
  (3,'doctor','Dr. Demo Doctor H03 018','doctor.h03.018@govcare.test','GCD-H03-DOC-018','govcare-demo-network-v1:h03:doctor:018','DEMO-WARD-018','$2a$10$znids0Ohgyx4262/H0GDaev9Ydoyl0mIDhs/sGkT4.2zioWn8ZgD6'),
  (3,'doctor','Dr. Demo Doctor H03 019','doctor.h03.019@govcare.test','GCD-H03-DOC-019','govcare-demo-network-v1:h03:doctor:019','DEMO-WARD-019','$2a$10$a8Siy5pKEwhaskI8aPeu4uc9SBm4lxjZYFL2HGmbZ39zwUUhdBn6e'),
  (3,'doctor','Dr. Demo Doctor H03 020','doctor.h03.020@govcare.test','GCD-H03-DOC-020','govcare-demo-network-v1:h03:doctor:020','DEMO-WARD-020','$2a$10$.230y8ygZ4j/K9lBRIjr8uisOkc4mhVgEsN8RujSo5egtODf/4jGm'),
  (3,'doctor','Dr. Demo Doctor H03 021','doctor.h03.021@govcare.test','GCD-H03-DOC-021','govcare-demo-network-v1:h03:doctor:021','DEMO-WARD-021','$2a$10$Dy6sT7M2heGkXJYfAClkgez0X9zEenmAGj.k9JvWs2wFBo5oNpLhu'),
  (3,'doctor','Dr. Demo Doctor H03 022','doctor.h03.022@govcare.test','GCD-H03-DOC-022','govcare-demo-network-v1:h03:doctor:022','DEMO-WARD-022','$2a$10$Zy9vyvEITCdWfTs3C7iDXu5.QyTTmYFW675xPyTkG0STDYFQVwT9e'),
  (3,'doctor','Dr. Demo Doctor H03 023','doctor.h03.023@govcare.test','GCD-H03-DOC-023','govcare-demo-network-v1:h03:doctor:023','DEMO-WARD-023','$2a$10$O4XPJyJpEtdw6Wqh4w.a5eMMwRdPNzFnAqxrNE6N3Q8mCH5Wf0lRa'),
  (3,'doctor','Dr. Demo Doctor H03 024','doctor.h03.024@govcare.test','GCD-H03-DOC-024','govcare-demo-network-v1:h03:doctor:024','DEMO-WARD-024','$2a$10$AgoEgFhBqo8hALOOCu2aB.XTZRvGekkccvmBI6fYezaQAQi3dqjSC'),
  (3,'doctor','Dr. Demo Doctor H03 025','doctor.h03.025@govcare.test','GCD-H03-DOC-025','govcare-demo-network-v1:h03:doctor:025','DEMO-WARD-025','$2a$10$R5X7OwjNLhBs.vcjsy9Atuyx0bVm4RmHgtUDK.OmdA7ASAndcu4X6'),
  (3,'doctor','Dr. Demo Doctor H03 026','doctor.h03.026@govcare.test','GCD-H03-DOC-026','govcare-demo-network-v1:h03:doctor:026','DEMO-WARD-026','$2a$10$JtaX1jAn/Vj16ZResqz5hu9AgpHpno61RqAgpbyRH4YMjZV2UwGdm'),
  (3,'doctor','Dr. Demo Doctor H03 027','doctor.h03.027@govcare.test','GCD-H03-DOC-027','govcare-demo-network-v1:h03:doctor:027','DEMO-WARD-027','$2a$10$3LviGbWOCK/6x14wnEZ7zuS1PTr7jIowWmjNEy7f/slg1cgxa5fz.'),
  (3,'doctor','Dr. Demo Doctor H03 028','doctor.h03.028@govcare.test','GCD-H03-DOC-028','govcare-demo-network-v1:h03:doctor:028','DEMO-WARD-028','$2a$10$i.7gUsxLhNVDki07rPqvJOfkILMZ21qUed/YWdB7u2yGFqvLNNpRK'),
  (3,'doctor','Dr. Demo Doctor H03 029','doctor.h03.029@govcare.test','GCD-H03-DOC-029','govcare-demo-network-v1:h03:doctor:029','DEMO-WARD-029','$2a$10$LTL8VqZgdAeslbN/wuR0cu0qknF8IQ/N9pTjyOxp676qLtiuSuNwu'),
  (3,'doctor','Dr. Demo Doctor H03 030','doctor.h03.030@govcare.test','GCD-H03-DOC-030','govcare-demo-network-v1:h03:doctor:030','DEMO-WARD-030','$2a$10$mySVrf2yanaP26Blyym.quvtXi3L7eSWBaWRu.txWwQ0890jx3y3O'),
  (3,'doctor','Dr. Demo Doctor H03 031','doctor.h03.031@govcare.test','GCD-H03-DOC-031','govcare-demo-network-v1:h03:doctor:031','DEMO-WARD-031','$2a$10$Z4L85hobqIXhJOiVb0Y86ulOYnRm7n2n9Mv/u8RVVlX4IqhfOcTMS'),
  (3,'doctor','Dr. Demo Doctor H03 032','doctor.h03.032@govcare.test','GCD-H03-DOC-032','govcare-demo-network-v1:h03:doctor:032','DEMO-WARD-032','$2a$10$IVMyASqIuKBsHamhP2wBDe8Pjg8UOvGLJiypYXvzwrm72wb9gxUGK'),
  (3,'doctor','Dr. Demo Doctor H03 033','doctor.h03.033@govcare.test','GCD-H03-DOC-033','govcare-demo-network-v1:h03:doctor:033','DEMO-WARD-033','$2a$10$ikleBkbLif.w18PeJkbvje0ptxnNH1kkIzx5IKqgz77fALrsvBdUu'),
  (3,'doctor','Dr. Demo Doctor H03 034','doctor.h03.034@govcare.test','GCD-H03-DOC-034','govcare-demo-network-v1:h03:doctor:034','DEMO-WARD-034','$2a$10$MVFa7Hb/fFSBphfvNg9p4eWVAfMctHqzSChEFokzp5boO70MChvoK'),
  (3,'doctor','Dr. Demo Doctor H03 035','doctor.h03.035@govcare.test','GCD-H03-DOC-035','govcare-demo-network-v1:h03:doctor:035','DEMO-WARD-035','$2a$10$MqiAiU2vESlKmpuDBQFLWeRPmUFYldInWjI4vJVtxKeCF9rrPYQky'),
  (3,'doctor','Dr. Demo Doctor H03 036','doctor.h03.036@govcare.test','GCD-H03-DOC-036','govcare-demo-network-v1:h03:doctor:036','DEMO-WARD-036','$2a$10$r00v7TOyhLA9jk10nZk46ur07kwnw1K6vtM2cai1wt1Sd5HVDFHqG'),
  (3,'doctor','Dr. Demo Doctor H03 037','doctor.h03.037@govcare.test','GCD-H03-DOC-037','govcare-demo-network-v1:h03:doctor:037','DEMO-WARD-037','$2a$10$ZjpbVqJm/yfiuwy.SdvL/OPCUG1lJjn4k0CTesXQrgw2Lk9VW.U5O'),
  (3,'doctor','Dr. Demo Doctor H03 038','doctor.h03.038@govcare.test','GCD-H03-DOC-038','govcare-demo-network-v1:h03:doctor:038','DEMO-WARD-038','$2a$10$ArKG6vhmNPAd3zXZ4wpjBu3GZzBDHt5TFQCpIQMalSqY6RgLyBQkG'),
  (3,'doctor','Dr. Demo Doctor H03 039','doctor.h03.039@govcare.test','GCD-H03-DOC-039','govcare-demo-network-v1:h03:doctor:039','DEMO-WARD-039','$2a$10$XOLdauKeC.jUq1z48AgDMeAkLmniIWwF/TXzLFjYV8Ll2xWhp7zZa'),
  (3,'doctor','Dr. Demo Doctor H03 040','doctor.h03.040@govcare.test','GCD-H03-DOC-040','govcare-demo-network-v1:h03:doctor:040','DEMO-WARD-040','$2a$10$N.EXwPBPYkAw1fGuPMu3Su6lRYLVsOwtsUw/quDNqxNDrCyxDZpCO'),
  (3,'doctor','Dr. Demo Doctor H03 041','doctor.h03.041@govcare.test','GCD-H03-DOC-041','govcare-demo-network-v1:h03:doctor:041','DEMO-WARD-041','$2a$10$.L85VycXrkkRycUAio1KSesqa0zivVR.2itrRQR7ibhou4T529mlm'),
  (3,'doctor','Dr. Demo Doctor H03 042','doctor.h03.042@govcare.test','GCD-H03-DOC-042','govcare-demo-network-v1:h03:doctor:042','DEMO-WARD-042','$2a$10$GnnqjZMO6Zn46ja2Lzgr4uuXp7q3/1MHb6f5lZNP.O7bhuceq5eOy'),
  (3,'doctor','Dr. Demo Doctor H03 043','doctor.h03.043@govcare.test','GCD-H03-DOC-043','govcare-demo-network-v1:h03:doctor:043','DEMO-WARD-043','$2a$10$5ndjmmph5XburA9efEz7wO4J4KqiAzpjWH2ybEfsraFWPv5k..nFS'),
  (3,'doctor','Dr. Demo Doctor H03 044','doctor.h03.044@govcare.test','GCD-H03-DOC-044','govcare-demo-network-v1:h03:doctor:044','DEMO-WARD-044','$2a$10$YwfI9HdZlSF0o9923SThQ.UVBCCTVzzEG6kkUkXXrv.HC4EjElcHK'),
  (3,'doctor','Dr. Demo Doctor H03 045','doctor.h03.045@govcare.test','GCD-H03-DOC-045','govcare-demo-network-v1:h03:doctor:045','DEMO-WARD-045','$2a$10$NvI6QApMilkCQqfygOhS9uDwWcujMCiGqdByOpXtMqxkI7mGzM/IK'),
  (3,'doctor','Dr. Demo Doctor H03 046','doctor.h03.046@govcare.test','GCD-H03-DOC-046','govcare-demo-network-v1:h03:doctor:046','DEMO-WARD-046','$2a$10$VC8PNwsfRCE7WRzCyP9yKOwEMSAKjnD3FjYbV/wxymt0BKQ1Da1Gq'),
  (3,'doctor','Dr. Demo Doctor H03 047','doctor.h03.047@govcare.test','GCD-H03-DOC-047','govcare-demo-network-v1:h03:doctor:047','DEMO-WARD-047','$2a$10$LP2Zd6tkbv5DAFDAe8zGPepcxpUZ5iqkpRzPmlkIEi1MBvHczA/C2'),
  (3,'doctor','Dr. Demo Doctor H03 048','doctor.h03.048@govcare.test','GCD-H03-DOC-048','govcare-demo-network-v1:h03:doctor:048','DEMO-WARD-048','$2a$10$LCqrCELZ7FlxLTx8s7z3eOLhn.tSHc2SQjC9/.sXs.hNdXjyrJ0SO'),
  (3,'doctor','Dr. Demo Doctor H03 049','doctor.h03.049@govcare.test','GCD-H03-DOC-049','govcare-demo-network-v1:h03:doctor:049','DEMO-WARD-049','$2a$10$k7FPzUOwBXhzm1eD.RaXDeNWqh883kJiS6o5aqRDzA/Bzr0Q1ABKu'),
  (3,'doctor','Dr. Demo Doctor H03 050','doctor.h03.050@govcare.test','GCD-H03-DOC-050','govcare-demo-network-v1:h03:doctor:050','DEMO-WARD-050','$2a$10$ZPsw.PXoRjxYAK6R1F13C.wLIEBZhG.nvKuyne0UmKdfMUJgKEZu6'),
  (3,'doctor','Dr. Demo Doctor H03 051','doctor.h03.051@govcare.test','GCD-H03-DOC-051','govcare-demo-network-v1:h03:doctor:051','DEMO-WARD-051','$2a$10$da08H3HSXlTYzmgo/oHSTuBgQa3wn0XiEP2fd7yFcXvMeBfiQ2NY2'),
  (3,'doctor','Dr. Demo Doctor H03 052','doctor.h03.052@govcare.test','GCD-H03-DOC-052','govcare-demo-network-v1:h03:doctor:052','DEMO-WARD-052','$2a$10$wkVUglvxvqb/W3SF/RlOvu.oTcm1wNyc2Pbr5f589u/IUqjom.qC6'),
  (3,'doctor','Dr. Demo Doctor H03 053','doctor.h03.053@govcare.test','GCD-H03-DOC-053','govcare-demo-network-v1:h03:doctor:053','DEMO-WARD-053','$2a$10$FnlSdfCc4QIBCQyL03T51OyAdPtMR3c2QuJAocqGz0DSOM4uQKto.'),
  (3,'doctor','Dr. Demo Doctor H03 054','doctor.h03.054@govcare.test','GCD-H03-DOC-054','govcare-demo-network-v1:h03:doctor:054','DEMO-WARD-054','$2a$10$Ty9zYVSFgniwY8jJs0bfaOy/Ldx01qkUnfFjkykjYUuiLLXsqf2he'),
  (3,'doctor','Dr. Demo Doctor H03 055','doctor.h03.055@govcare.test','GCD-H03-DOC-055','govcare-demo-network-v1:h03:doctor:055','DEMO-WARD-055','$2a$10$ekQwH2gH4kFYDv4EI6LOeOnwoK6eCgZ0IyGRTHC0XHdPF2s1KoAGm'),
  (3,'doctor','Dr. Demo Doctor H03 056','doctor.h03.056@govcare.test','GCD-H03-DOC-056','govcare-demo-network-v1:h03:doctor:056','DEMO-WARD-056','$2a$10$DK23Gg2dgy28DGjaAquE.eewVSTtdRMAht3dbcgUVT.1q59h.Adde'),
  (3,'doctor','Dr. Demo Doctor H03 057','doctor.h03.057@govcare.test','GCD-H03-DOC-057','govcare-demo-network-v1:h03:doctor:057','DEMO-WARD-057','$2a$10$q2nN3w6qSumUBx1RCz2OoeNix4YhvjEYqXqGVnlbKkOZ1CZN0GpQ.'),
  (3,'doctor','Dr. Demo Doctor H03 058','doctor.h03.058@govcare.test','GCD-H03-DOC-058','govcare-demo-network-v1:h03:doctor:058','DEMO-WARD-058','$2a$10$KT09YeZhJtP2qIeyIoArg.9B3Z7Ua/D71ZqtFgxMzMoFWaRK9KjJi'),
  (3,'doctor','Dr. Demo Doctor H03 059','doctor.h03.059@govcare.test','GCD-H03-DOC-059','govcare-demo-network-v1:h03:doctor:059','DEMO-WARD-059','$2a$10$vlHNJw2RKbS5wdC7WAS1su0kdagMYNbdxN99CRz.U24QE6zdNqjGy'),
  (3,'doctor','Dr. Demo Doctor H03 060','doctor.h03.060@govcare.test','GCD-H03-DOC-060','govcare-demo-network-v1:h03:doctor:060','DEMO-WARD-060','$2a$10$TSLgVHO8MVoxOUjHqZrub.vJ.Jxh.LbnpgUYAT6uP80jD1Df/qd6S'),
  (3,'doctor','Dr. Demo Doctor H03 061','doctor.h03.061@govcare.test','GCD-H03-DOC-061','govcare-demo-network-v1:h03:doctor:061','DEMO-WARD-061','$2a$10$X1bkP1IOL2YhPetk80AvQOLpCJDzMp/eNxCxDmiOHSa9ycxu94sSq'),
  (3,'doctor','Dr. Demo Doctor H03 062','doctor.h03.062@govcare.test','GCD-H03-DOC-062','govcare-demo-network-v1:h03:doctor:062','DEMO-WARD-062','$2a$10$cMUjuAFAInPeQ62hXLkxyenoYCLabZeJWKTbPGCb7dBHLlQwZi/M2'),
  (3,'doctor','Dr. Demo Doctor H03 063','doctor.h03.063@govcare.test','GCD-H03-DOC-063','govcare-demo-network-v1:h03:doctor:063','DEMO-WARD-063','$2a$10$NpxcmS/l2d3aTYbq7CfYv.ksLMLVzAnpK9FWGMfaLE9knOW40xg8O'),
  (3,'doctor','Dr. Demo Doctor H03 064','doctor.h03.064@govcare.test','GCD-H03-DOC-064','govcare-demo-network-v1:h03:doctor:064','DEMO-WARD-064','$2a$10$..BtFPHO5QNLQKfmFjIa0.ZAS3yuO.g4LNwNDZwe4NrKloSZ8t71e'),
  (3,'doctor','Dr. Demo Doctor H03 065','doctor.h03.065@govcare.test','GCD-H03-DOC-065','govcare-demo-network-v1:h03:doctor:065','DEMO-WARD-065','$2a$10$ko5hAMIcHo/I.DkrGQ1Tge4PPUHi1ETkG0RtHk6gHiGjsjlNR3RnO'),
  (3,'doctor','Dr. Demo Doctor H03 066','doctor.h03.066@govcare.test','GCD-H03-DOC-066','govcare-demo-network-v1:h03:doctor:066','DEMO-WARD-066','$2a$10$m5d9kebaBHu9/zz3FYzGD.2AHxohCrPhRPIBWyZG185bfdmuQS.T.'),
  (3,'doctor','Dr. Demo Doctor H03 067','doctor.h03.067@govcare.test','GCD-H03-DOC-067','govcare-demo-network-v1:h03:doctor:067','DEMO-WARD-067','$2a$10$aFb37eeSLyaOWhqymxEXdOQxfVQsM0dl83JQuau2/dQARAAbR2tsG'),
  (3,'doctor','Dr. Demo Doctor H03 068','doctor.h03.068@govcare.test','GCD-H03-DOC-068','govcare-demo-network-v1:h03:doctor:068','DEMO-WARD-068','$2a$10$jsjwTB/uWiWYJMai9hjM0.9CccUyVdj0viNUVIfWKdQhFwxfvqcxS'),
  (3,'doctor','Dr. Demo Doctor H03 069','doctor.h03.069@govcare.test','GCD-H03-DOC-069','govcare-demo-network-v1:h03:doctor:069','DEMO-WARD-069','$2a$10$lfTuHVgF6lWYn.dAKJKK4uxfGyCvU72FjBXExkSDhlhQk05ThZeve'),
  (3,'doctor','Dr. Demo Doctor H03 070','doctor.h03.070@govcare.test','GCD-H03-DOC-070','govcare-demo-network-v1:h03:doctor:070','DEMO-WARD-070','$2a$10$deacczdTnHBW0aI9Susme.WsHsAycsyv2dUiEIEPwbazKhWO5Vzzi'),
  (3,'doctor','Dr. Demo Doctor H03 071','doctor.h03.071@govcare.test','GCD-H03-DOC-071','govcare-demo-network-v1:h03:doctor:071','DEMO-WARD-071','$2a$10$ZItp3YMOrl3VdLkSTH8GROHJ2BsirjFkgXBEfsfW0qrmZyeER.07e'),
  (3,'doctor','Dr. Demo Doctor H03 072','doctor.h03.072@govcare.test','GCD-H03-DOC-072','govcare-demo-network-v1:h03:doctor:072','DEMO-WARD-072','$2a$10$WDnIr3vvhT3CjCyh1hMnAO6kTyVpC6v75RzQZNXQCELRuyChN1lry'),
  (3,'doctor','Dr. Demo Doctor H03 073','doctor.h03.073@govcare.test','GCD-H03-DOC-073','govcare-demo-network-v1:h03:doctor:073','DEMO-WARD-073','$2a$10$NEpndH76cfZCJGvtgBlpMuHVJxv1yNsdapn8Y0QYAwOWW8sIffTPC'),
  (3,'doctor','Dr. Demo Doctor H03 074','doctor.h03.074@govcare.test','GCD-H03-DOC-074','govcare-demo-network-v1:h03:doctor:074','DEMO-WARD-074','$2a$10$7OGHU4gvdR/Yc/mQV6.BvOHe3/.GUQrdQmjHgwX6wGZQ.CtjNz5ga'),
  (3,'doctor','Dr. Demo Doctor H03 075','doctor.h03.075@govcare.test','GCD-H03-DOC-075','govcare-demo-network-v1:h03:doctor:075','DEMO-WARD-075','$2a$10$Z5W/fd84qX2A24fE5Z/ZhehikkR94fVmJ6EqrXl5QZMQcUYYVSRWC'),
  (3,'doctor','Dr. Demo Doctor H03 076','doctor.h03.076@govcare.test','GCD-H03-DOC-076','govcare-demo-network-v1:h03:doctor:076','DEMO-WARD-076','$2a$10$vBIqWPVQ4mR4eAz6rk90jOPP/1xA/G3YoSgYkLoKOpiqgYLF4mNSK'),
  (3,'doctor','Dr. Demo Doctor H03 077','doctor.h03.077@govcare.test','GCD-H03-DOC-077','govcare-demo-network-v1:h03:doctor:077','DEMO-WARD-077','$2a$10$sQw7mNQ/CZl9W7iHY/DcluUWtaYdYiMauCjeph3MEWiUkA3xVN1i2'),
  (3,'doctor','Dr. Demo Doctor H03 078','doctor.h03.078@govcare.test','GCD-H03-DOC-078','govcare-demo-network-v1:h03:doctor:078','DEMO-WARD-078','$2a$10$mFF8vOmQHYG.1bPoDGq5De.pb/jH6.SjH./ZhXNsiWnD2DO0.2IQS'),
  (3,'doctor','Dr. Demo Doctor H03 079','doctor.h03.079@govcare.test','GCD-H03-DOC-079','govcare-demo-network-v1:h03:doctor:079','DEMO-WARD-079','$2a$10$/og4eXPjVj5yZINkVK.75u34hXw6xrEiZOL5iB9Y4juaymA/qGDvG'),
  (3,'doctor','Dr. Demo Doctor H03 080','doctor.h03.080@govcare.test','GCD-H03-DOC-080','govcare-demo-network-v1:h03:doctor:080','DEMO-WARD-080','$2a$10$5rNS3PlWC3y/p0Enk1og0ewp4zomcaYz25N2gMfUtBqOeEL6cZ6QG'),
  (3,'doctor','Dr. Demo Doctor H03 081','doctor.h03.081@govcare.test','GCD-H03-DOC-081','govcare-demo-network-v1:h03:doctor:081','DEMO-WARD-081','$2a$10$.6jPLAizZ6WKMVCeCJ5Wzump6dlh8jELnXw8IZsyNBld6kUpS622q'),
  (3,'doctor','Dr. Demo Doctor H03 082','doctor.h03.082@govcare.test','GCD-H03-DOC-082','govcare-demo-network-v1:h03:doctor:082','DEMO-WARD-082','$2a$10$WFbJgIQdQsd7/jg3KZtUX.QMAFFtU3rRNAjWF/biV8B.zdf7XO1oG'),
  (3,'doctor','Dr. Demo Doctor H03 083','doctor.h03.083@govcare.test','GCD-H03-DOC-083','govcare-demo-network-v1:h03:doctor:083','DEMO-WARD-083','$2a$10$seavsPfSbKfZu/S/YQpLV.YAMXnyKF2341BFcdWVY59z0Utrljy.K'),
  (3,'doctor','Dr. Demo Doctor H03 084','doctor.h03.084@govcare.test','GCD-H03-DOC-084','govcare-demo-network-v1:h03:doctor:084','DEMO-WARD-084','$2a$10$XSXvrtNEomMdr6Cvm.HALeWlvcXtRqexq07KC0zW/MCqLHQVmrzkO'),
  (3,'doctor','Dr. Demo Doctor H03 085','doctor.h03.085@govcare.test','GCD-H03-DOC-085','govcare-demo-network-v1:h03:doctor:085','DEMO-WARD-085','$2a$10$PynKfsl6oqu7c5a15Y1tLuY6cOOvXAyPWyj3.ZgEN8UAdP3d23IA6'),
  (3,'doctor','Dr. Demo Doctor H03 086','doctor.h03.086@govcare.test','GCD-H03-DOC-086','govcare-demo-network-v1:h03:doctor:086','DEMO-WARD-086','$2a$10$kANIVfi6Kjxi46/KXwR/PezPtNPiPojG/osgyaHyj4/IEbSrQPfOe'),
  (3,'doctor','Dr. Demo Doctor H03 087','doctor.h03.087@govcare.test','GCD-H03-DOC-087','govcare-demo-network-v1:h03:doctor:087','DEMO-WARD-087','$2a$10$xNhkI.UmznbWhBebtQDDmOJjLyJ0D218RE7f8FVt8Kancd6fd2Oou'),
  (3,'doctor','Dr. Demo Doctor H03 088','doctor.h03.088@govcare.test','GCD-H03-DOC-088','govcare-demo-network-v1:h03:doctor:088','DEMO-WARD-088','$2a$10$Ff3o5dQTZoH0c8ZQxaHe5OsQ6k3/2kbYmX9Jf1IHlssfMM1Tg2Cae'),
  (3,'doctor','Dr. Demo Doctor H03 089','doctor.h03.089@govcare.test','GCD-H03-DOC-089','govcare-demo-network-v1:h03:doctor:089','DEMO-WARD-089','$2a$10$NSaG0pOF3xH5e02inB/dUu5kNGyJNPQV7BAR6eWOS3Gr6ipXVB.Q.'),
  (3,'doctor','Dr. Demo Doctor H03 090','doctor.h03.090@govcare.test','GCD-H03-DOC-090','govcare-demo-network-v1:h03:doctor:090','DEMO-WARD-090','$2a$10$RMnafLJOIUm0yGfRQwAS2eK0ZVB9ksoclsYgcEjWef5OFdi9eg3kq'),
  (3,'doctor','Dr. Demo Doctor H03 091','doctor.h03.091@govcare.test','GCD-H03-DOC-091','govcare-demo-network-v1:h03:doctor:091','DEMO-WARD-091','$2a$10$6eYsbHn1BlzpNkZ6dyoR4O6j6YYjF/YgzADPUTxYfOvFG7in3Zvx2'),
  (3,'doctor','Dr. Demo Doctor H03 092','doctor.h03.092@govcare.test','GCD-H03-DOC-092','govcare-demo-network-v1:h03:doctor:092','DEMO-WARD-092','$2a$10$L8mxA.c56ORPy55wlliusOgg7mO8363EhAXYA8/q4mnO8kkOLQ/Nm'),
  (3,'doctor','Dr. Demo Doctor H03 093','doctor.h03.093@govcare.test','GCD-H03-DOC-093','govcare-demo-network-v1:h03:doctor:093','DEMO-WARD-093','$2a$10$FCtVPpluif2TEFmaVowcsurgSUGsEWF92EFD.xBVLpl/cdtfrZKSi'),
  (3,'doctor','Dr. Demo Doctor H03 094','doctor.h03.094@govcare.test','GCD-H03-DOC-094','govcare-demo-network-v1:h03:doctor:094','DEMO-WARD-094','$2a$10$b2pBlAz0PET72lU4B2UhAe8.QQSCSlP26uXegMIGT.34UCqMVKZh.'),
  (3,'doctor','Dr. Demo Doctor H03 095','doctor.h03.095@govcare.test','GCD-H03-DOC-095','govcare-demo-network-v1:h03:doctor:095','DEMO-WARD-095','$2a$10$oN/9duJYgs8VZWcdr9Q9EOWuSa8kNxHiVq9rLzFPG6FvbAEKw5ObO'),
  (3,'doctor','Dr. Demo Doctor H03 096','doctor.h03.096@govcare.test','GCD-H03-DOC-096','govcare-demo-network-v1:h03:doctor:096','DEMO-WARD-096','$2a$10$vy.t./IG.7UdfgPOTEM64eOYnwmzT7miRrZvvmCcvGK31pd.SWD32'),
  (3,'doctor','Dr. Demo Doctor H03 097','doctor.h03.097@govcare.test','GCD-H03-DOC-097','govcare-demo-network-v1:h03:doctor:097','DEMO-WARD-097','$2a$10$0a0CopEpN51P/YVocdIeOuDMv1ElOyCIvpq.QtI0rfadXw2pH/i7y'),
  (3,'doctor','Dr. Demo Doctor H03 098','doctor.h03.098@govcare.test','GCD-H03-DOC-098','govcare-demo-network-v1:h03:doctor:098','DEMO-WARD-098','$2a$10$mhZVnyx2sjhcpGsTS5CZKeRjHGJq/63ZA8sayYC8j2ZeMitgz3eRW'),
  (3,'doctor','Dr. Demo Doctor H03 099','doctor.h03.099@govcare.test','GCD-H03-DOC-099','govcare-demo-network-v1:h03:doctor:099','DEMO-WARD-099','$2a$10$3FbUCMI/0KnmQZY.8rOUu.s65d0V8Vy3snynaswVf2YhSkSjRrC9K'),
  (3,'doctor','Dr. Demo Doctor H03 100','doctor.h03.100@govcare.test','GCD-H03-DOC-100','govcare-demo-network-v1:h03:doctor:100','DEMO-WARD-100','$2a$10$XBjtHJDzKUY2p16dUpvSeuEoDCiDfOC8/GTx/K8.tVm0sM6AGlvvm'),
  (3,'hospital_admin','Demo Hospital Admin H03','admin.h03@govcare.test','GCD-H03-ADMIN','govcare-demo-network-v1:h03:hospital_admin','ADMIN','$2a$10$5Rcfg5y1G9uYmVgkjTUCJebMtN/K8j3y4jL9/piGsoOkaAJe82bqS'),
  (3,'receptionist','Demo Front Desk Officer H03','reception.h03@govcare.test','GCD-H03-RECEPTION','govcare-demo-network-v1:h03:receptionist','RECEPTION','$2a$10$J4inX0yZiTNiWpCdpqi4feMvdQimF.xBiP5Jmc1MLA3DQV/9GTinu'),
  (3,'nurse','Demo Nurse H03','nurse.h03@govcare.test','GCD-H03-NURSE','govcare-demo-network-v1:h03:nurse','DEMO-WARD-001','$2a$10$7co0xzf1fW71o5IphOpd/eSj8k5swIIrt7UPkh36OKoyx1zmHsbwa'),
  (3,'ward_manager','Demo Ward Manager H03','wardmanager.h03@govcare.test','GCD-H03-WARDMANAGER','govcare-demo-network-v1:h03:ward_manager','DEMO-WARD-001','$2a$10$UgNIIWXd50nVvNhTKR8OiuRgJdPusskWI3j7cU8xg0OdfogKztB2O'),
  (3,'patient','Demo Patient Portal User H03','patient.h03@govcare.test','GCD-H03-PATIENT','govcare-demo-network-v1:h03:patient',null,'$2a$10$eJRUkLBDkWWz5UTtAf.i6edPVJG6qRoAj5Kxv9L8CiX7d3tWUxA.a'),
  (3,'guardian','Demo Guardian Portal User H03','guardian.h03@govcare.test','GCD-H03-GUARDIAN','govcare-demo-network-v1:h03:guardian',null,'$2a$10$PNGr8YS4IpErRn4chJK0MuujXAA/nhAVYFeAN5ubtCnu/3AGbQf92'),
  (4,'doctor','Dr. Demo Doctor H04 001','doctor.h04.001@govcare.test','GCD-H04-DOC-001','govcare-demo-network-v1:h04:doctor:001','DEMO-WARD-001','$2a$10$I7fdXQVDsHrZkf2eyh8l.e1et5LcBMi1Mk9To0uBBsAwHeZP3/vum'),
  (4,'doctor','Dr. Demo Doctor H04 002','doctor.h04.002@govcare.test','GCD-H04-DOC-002','govcare-demo-network-v1:h04:doctor:002','DEMO-WARD-002','$2a$10$B0Wvo9xh6tTHPDiYt8YP.OBvCdh9bNfvOC5vWRUVOTZMbHcIBgSfW'),
  (4,'doctor','Dr. Demo Doctor H04 003','doctor.h04.003@govcare.test','GCD-H04-DOC-003','govcare-demo-network-v1:h04:doctor:003','DEMO-WARD-003','$2a$10$alqrkVEMj02deUfj1ZX5Wu6Yr9DIRY5fZYjNGjieNRwmENa9EQcne'),
  (4,'doctor','Dr. Demo Doctor H04 004','doctor.h04.004@govcare.test','GCD-H04-DOC-004','govcare-demo-network-v1:h04:doctor:004','DEMO-WARD-004','$2a$10$R6GaH30sEzdIGGnCUSKwiuxt5TYK2qWkEkrTY8t8OLSsMCJYraaty'),
  (4,'doctor','Dr. Demo Doctor H04 005','doctor.h04.005@govcare.test','GCD-H04-DOC-005','govcare-demo-network-v1:h04:doctor:005','DEMO-WARD-005','$2a$10$aeZBstx../VSi7xe3KvXueMgahtH3T9lkAPydP5GsRMXQ.qyBX8Mm'),
  (4,'doctor','Dr. Demo Doctor H04 006','doctor.h04.006@govcare.test','GCD-H04-DOC-006','govcare-demo-network-v1:h04:doctor:006','DEMO-WARD-006','$2a$10$zKbh5/eSO/Gsazhir55dWOJb2h/4xcpGY2jOlwv01bazbFPLGwo5K'),
  (4,'doctor','Dr. Demo Doctor H04 007','doctor.h04.007@govcare.test','GCD-H04-DOC-007','govcare-demo-network-v1:h04:doctor:007','DEMO-WARD-007','$2a$10$E7YabytD3j/IdUidxPws.uXwpye5TeQ9qKt8M6QpN89LdtB7rfgwe'),
  (4,'doctor','Dr. Demo Doctor H04 008','doctor.h04.008@govcare.test','GCD-H04-DOC-008','govcare-demo-network-v1:h04:doctor:008','DEMO-WARD-008','$2a$10$XSg.4qyuH90DX2d3g/gnBOJH9aWvjf3pkWO72hh08kz6lLHCFs9cm'),
  (4,'doctor','Dr. Demo Doctor H04 009','doctor.h04.009@govcare.test','GCD-H04-DOC-009','govcare-demo-network-v1:h04:doctor:009','DEMO-WARD-009','$2a$10$IYRJqkef/uKfn8wykv/Jx.ycVqQ2HXaIZaJsgdJPolcWRRFwO1GJe'),
  (4,'doctor','Dr. Demo Doctor H04 010','doctor.h04.010@govcare.test','GCD-H04-DOC-010','govcare-demo-network-v1:h04:doctor:010','DEMO-WARD-010','$2a$10$bqOuDhS57378tkVeE1oF4OSekYrNClzDV6o1OaqFoqyR9irNbM2tq'),
  (4,'doctor','Dr. Demo Doctor H04 011','doctor.h04.011@govcare.test','GCD-H04-DOC-011','govcare-demo-network-v1:h04:doctor:011','DEMO-WARD-011','$2a$10$jXRi8rfOnYaeataVZFcl2uoDEoM5nFzCasDY2/WyNzDH/70srxqWG'),
  (4,'doctor','Dr. Demo Doctor H04 012','doctor.h04.012@govcare.test','GCD-H04-DOC-012','govcare-demo-network-v1:h04:doctor:012','DEMO-WARD-012','$2a$10$.pnIAk7fBTEmE/7lG0bj.u4ExrdouGyOrt2k5LuZr10t0EyhmPlCe'),
  (4,'doctor','Dr. Demo Doctor H04 013','doctor.h04.013@govcare.test','GCD-H04-DOC-013','govcare-demo-network-v1:h04:doctor:013','DEMO-WARD-013','$2a$10$oEeTYnRmT9WB.gZlIrTK3uu1HWriMRa0VsgnOKzuHtOLZU/gIUcru'),
  (4,'doctor','Dr. Demo Doctor H04 014','doctor.h04.014@govcare.test','GCD-H04-DOC-014','govcare-demo-network-v1:h04:doctor:014','DEMO-WARD-014','$2a$10$h/wleeFpig0EVkJxusTSuuXAQbIqGlsjnOOO7s6wctxKszJnSgNOS'),
  (4,'doctor','Dr. Demo Doctor H04 015','doctor.h04.015@govcare.test','GCD-H04-DOC-015','govcare-demo-network-v1:h04:doctor:015','DEMO-WARD-015','$2a$10$Utku3k9imsS6ccGwkil7B.TRUOVpbuUcjkgNsdE1t91e5KwZDa6j6'),
  (4,'doctor','Dr. Demo Doctor H04 016','doctor.h04.016@govcare.test','GCD-H04-DOC-016','govcare-demo-network-v1:h04:doctor:016','DEMO-WARD-016','$2a$10$gC5zOCk61c6Zdg6E1NJgs.vefxLkQMF9VmAmY30.UJ.cu80wvCKae'),
  (4,'doctor','Dr. Demo Doctor H04 017','doctor.h04.017@govcare.test','GCD-H04-DOC-017','govcare-demo-network-v1:h04:doctor:017','DEMO-WARD-017','$2a$10$kZ58iGBntVRtYu1S1rXy6.DqgeZp66eq3y8EsFykKNd39N7APvAme'),
  (4,'doctor','Dr. Demo Doctor H04 018','doctor.h04.018@govcare.test','GCD-H04-DOC-018','govcare-demo-network-v1:h04:doctor:018','DEMO-WARD-018','$2a$10$utT9CHik2CPHjg4L2KaJQew0tBLhw2NHVIwV8j5eTh3NyrhMc0Fce'),
  (4,'doctor','Dr. Demo Doctor H04 019','doctor.h04.019@govcare.test','GCD-H04-DOC-019','govcare-demo-network-v1:h04:doctor:019','DEMO-WARD-019','$2a$10$kij7jD.YtfqfTv0m39T04.Vg5cWkk6fExlKVhFf6ZMQ.rdGORu0km'),
  (4,'doctor','Dr. Demo Doctor H04 020','doctor.h04.020@govcare.test','GCD-H04-DOC-020','govcare-demo-network-v1:h04:doctor:020','DEMO-WARD-020','$2a$10$zUEBqW4JLdLD7pNXe/azcer3lRqMpfw8sq5Oz03lfuoH0ysIUmMBO'),
  (4,'doctor','Dr. Demo Doctor H04 021','doctor.h04.021@govcare.test','GCD-H04-DOC-021','govcare-demo-network-v1:h04:doctor:021','DEMO-WARD-021','$2a$10$NkU.p5JLqcYlKCdutRwlpeTHtL2aQdjrvQFi8DJLDKvqiKY1nZdkm'),
  (4,'doctor','Dr. Demo Doctor H04 022','doctor.h04.022@govcare.test','GCD-H04-DOC-022','govcare-demo-network-v1:h04:doctor:022','DEMO-WARD-022','$2a$10$1yrLNYQkZLopYLTg5FtFoeEjZk9YWMFMbiZAZYVlMUDHF7/heB5W2'),
  (4,'doctor','Dr. Demo Doctor H04 023','doctor.h04.023@govcare.test','GCD-H04-DOC-023','govcare-demo-network-v1:h04:doctor:023','DEMO-WARD-023','$2a$10$Sp24hbxpgOOjhC8Qbg/0W.9hRLxZeXmtiF6nSUT3/xZXJsRUCWGuS'),
  (4,'doctor','Dr. Demo Doctor H04 024','doctor.h04.024@govcare.test','GCD-H04-DOC-024','govcare-demo-network-v1:h04:doctor:024','DEMO-WARD-024','$2a$10$9liH9FY5xyN.AsJ2iWasUuFRfLO16IQCWVdW7Zx.ZM8YRqQIfmnka'),
  (4,'doctor','Dr. Demo Doctor H04 025','doctor.h04.025@govcare.test','GCD-H04-DOC-025','govcare-demo-network-v1:h04:doctor:025','DEMO-WARD-025','$2a$10$4xEP2l5rUtdXO9I.P1fwGuSZqce2f2aTl1zqP4dCqTyfa4PZdKmMy'),
  (4,'doctor','Dr. Demo Doctor H04 026','doctor.h04.026@govcare.test','GCD-H04-DOC-026','govcare-demo-network-v1:h04:doctor:026','DEMO-WARD-026','$2a$10$/Ey4RssW1L34Y/p0C67hK.KqYuHsUtc8Mrqx8tc9qHBLYhMIoyKlm'),
  (4,'doctor','Dr. Demo Doctor H04 027','doctor.h04.027@govcare.test','GCD-H04-DOC-027','govcare-demo-network-v1:h04:doctor:027','DEMO-WARD-027','$2a$10$qvYV.3DndpjfDLUHDteoleKc1Wx7Kw8tR2c4ig/KUbVSHbuHP4wqq'),
  (4,'doctor','Dr. Demo Doctor H04 028','doctor.h04.028@govcare.test','GCD-H04-DOC-028','govcare-demo-network-v1:h04:doctor:028','DEMO-WARD-028','$2a$10$caxSRZRTU3BcP0TN4zwuoOddCmzHc2BUwbJ2d5k5c6kClTztZkbe.'),
  (4,'doctor','Dr. Demo Doctor H04 029','doctor.h04.029@govcare.test','GCD-H04-DOC-029','govcare-demo-network-v1:h04:doctor:029','DEMO-WARD-029','$2a$10$W9oj6buolb1aVvqZEUZR4e1yx6AQDo5kmUykgHWb2vM7NbLbVvTI.'),
  (4,'doctor','Dr. Demo Doctor H04 030','doctor.h04.030@govcare.test','GCD-H04-DOC-030','govcare-demo-network-v1:h04:doctor:030','DEMO-WARD-030','$2a$10$GQnCOetEwUojmmV0G210qeTwEsV2UkJCNwCzEncT/fTcrPaVv3Z0C'),
  (4,'doctor','Dr. Demo Doctor H04 031','doctor.h04.031@govcare.test','GCD-H04-DOC-031','govcare-demo-network-v1:h04:doctor:031','DEMO-WARD-031','$2a$10$xSF8kQ7PPhVYvY0AkOmlY.UDE1UbxH9xzDp98HrT/mIiCNNk9sZ42'),
  (4,'doctor','Dr. Demo Doctor H04 032','doctor.h04.032@govcare.test','GCD-H04-DOC-032','govcare-demo-network-v1:h04:doctor:032','DEMO-WARD-032','$2a$10$gQlmd/qr4Rzw4TL65tHt7u3W/zNRwiG2FeUf6Xc2O5r9Uk9qCbY76'),
  (4,'doctor','Dr. Demo Doctor H04 033','doctor.h04.033@govcare.test','GCD-H04-DOC-033','govcare-demo-network-v1:h04:doctor:033','DEMO-WARD-033','$2a$10$pHa0jV6wXnXtpUc1sQlfOe5dTSglOGkwdlvvPhzgmrsMProAQkTuq'),
  (4,'doctor','Dr. Demo Doctor H04 034','doctor.h04.034@govcare.test','GCD-H04-DOC-034','govcare-demo-network-v1:h04:doctor:034','DEMO-WARD-034','$2a$10$ZB0nKeQJZmYa/aZ/38bX.Ot3DPQxu1MfhP7ztZReXy0VHRp8aVMq6'),
  (4,'doctor','Dr. Demo Doctor H04 035','doctor.h04.035@govcare.test','GCD-H04-DOC-035','govcare-demo-network-v1:h04:doctor:035','DEMO-WARD-035','$2a$10$P95rJqrmfzhtXQNdkQ7IJuBr90PjzLofs69/m6a.6VuCHVxJ1QunO'),
  (4,'doctor','Dr. Demo Doctor H04 036','doctor.h04.036@govcare.test','GCD-H04-DOC-036','govcare-demo-network-v1:h04:doctor:036','DEMO-WARD-036','$2a$10$uGP0Shr0y17euq3J9FEA4OExj3SXjK1NOqNDwBLIkeOiRc8YczLty'),
  (4,'doctor','Dr. Demo Doctor H04 037','doctor.h04.037@govcare.test','GCD-H04-DOC-037','govcare-demo-network-v1:h04:doctor:037','DEMO-WARD-037','$2a$10$NJxmxDTwBcL9enigrnGfKOnfZsdEYsCOs3K0X7.Jfoo0T6ABet3Me'),
  (4,'doctor','Dr. Demo Doctor H04 038','doctor.h04.038@govcare.test','GCD-H04-DOC-038','govcare-demo-network-v1:h04:doctor:038','DEMO-WARD-038','$2a$10$S8HX1mH0ZJChCTZ/UxXYy.k2WxNqrKnzEnpy.O1glN.iCCcG3OEFG'),
  (4,'doctor','Dr. Demo Doctor H04 039','doctor.h04.039@govcare.test','GCD-H04-DOC-039','govcare-demo-network-v1:h04:doctor:039','DEMO-WARD-039','$2a$10$oUw405dIAFJih6JzzYhVXuHur9gnwPm7U4nCjK7K0g.qHHBvtbUF2'),
  (4,'doctor','Dr. Demo Doctor H04 040','doctor.h04.040@govcare.test','GCD-H04-DOC-040','govcare-demo-network-v1:h04:doctor:040','DEMO-WARD-040','$2a$10$HSSOWYW75fIjsE9xPWFe8uRuSGMOJk/gAzLjeQBIpHjv5CJPREqbe'),
  (4,'doctor','Dr. Demo Doctor H04 041','doctor.h04.041@govcare.test','GCD-H04-DOC-041','govcare-demo-network-v1:h04:doctor:041','DEMO-WARD-041','$2a$10$AI.paF0PLdsLYSAdDZfjnudCmUszDVIQpzsd8oHLdPqkH1XIvE6Dy'),
  (4,'doctor','Dr. Demo Doctor H04 042','doctor.h04.042@govcare.test','GCD-H04-DOC-042','govcare-demo-network-v1:h04:doctor:042','DEMO-WARD-042','$2a$10$.tQ2ENO7XZSy9bA3AZ0lAOw9L8Yv10pUDP9ZGB8HfSdGTUmXgNcV6'),
  (4,'doctor','Dr. Demo Doctor H04 043','doctor.h04.043@govcare.test','GCD-H04-DOC-043','govcare-demo-network-v1:h04:doctor:043','DEMO-WARD-043','$2a$10$7w/JkJBrnBM5/bKQwzZIReGDRRSlbObM/Z/50c1hgU37T.8ZLcb4i'),
  (4,'doctor','Dr. Demo Doctor H04 044','doctor.h04.044@govcare.test','GCD-H04-DOC-044','govcare-demo-network-v1:h04:doctor:044','DEMO-WARD-044','$2a$10$SrHF6on8quBEO7ZX7mO8FuKDu6/QSDm63tTlhokM31YbPd3JpZpbq'),
  (4,'doctor','Dr. Demo Doctor H04 045','doctor.h04.045@govcare.test','GCD-H04-DOC-045','govcare-demo-network-v1:h04:doctor:045','DEMO-WARD-045','$2a$10$JPl0w9qvf.5Puv2xaJnWletG2beBO3sdjhFEkStahzFDcXmL4yKfm'),
  (4,'doctor','Dr. Demo Doctor H04 046','doctor.h04.046@govcare.test','GCD-H04-DOC-046','govcare-demo-network-v1:h04:doctor:046','DEMO-WARD-046','$2a$10$0wuUxeltErZm90PzbChtlOaBJ8B8.Nm4v2FrCOCHdW1ca1alK29Lu'),
  (4,'doctor','Dr. Demo Doctor H04 047','doctor.h04.047@govcare.test','GCD-H04-DOC-047','govcare-demo-network-v1:h04:doctor:047','DEMO-WARD-047','$2a$10$WA5FVNAm3yAfxexe5hO3AuCDG0YF2BnkFNnrompPrr.xDBB0BiXXm'),
  (4,'doctor','Dr. Demo Doctor H04 048','doctor.h04.048@govcare.test','GCD-H04-DOC-048','govcare-demo-network-v1:h04:doctor:048','DEMO-WARD-048','$2a$10$rZjIqDIbqE7b/POja32L4.kQA1bU/xrot5rOK/NmbT1R1egFel7Kq'),
  (4,'doctor','Dr. Demo Doctor H04 049','doctor.h04.049@govcare.test','GCD-H04-DOC-049','govcare-demo-network-v1:h04:doctor:049','DEMO-WARD-049','$2a$10$C0QcUcuvWdMysRDSI0NcK.g28TC7ciZ0ONj3T/a48N4HlMdY8Z3Bq'),
  (4,'doctor','Dr. Demo Doctor H04 050','doctor.h04.050@govcare.test','GCD-H04-DOC-050','govcare-demo-network-v1:h04:doctor:050','DEMO-WARD-050','$2a$10$Fd51qaDfdRV4CUWxPY97AuiMvjV4QW5BP9GOR2l5fo/AMWRSTbRpS'),
  (4,'doctor','Dr. Demo Doctor H04 051','doctor.h04.051@govcare.test','GCD-H04-DOC-051','govcare-demo-network-v1:h04:doctor:051','DEMO-WARD-051','$2a$10$LH7Ex8cZ25sABG/Otik7r.W9o2d2KQbZSgybl1bBFlBLk6LwdNcLm'),
  (4,'doctor','Dr. Demo Doctor H04 052','doctor.h04.052@govcare.test','GCD-H04-DOC-052','govcare-demo-network-v1:h04:doctor:052','DEMO-WARD-052','$2a$10$WByb240BrxIXrKq9pnMzg.CglZIzzZgk/tXgvf4Xcz9gkN0WozRTm'),
  (4,'doctor','Dr. Demo Doctor H04 053','doctor.h04.053@govcare.test','GCD-H04-DOC-053','govcare-demo-network-v1:h04:doctor:053','DEMO-WARD-053','$2a$10$GDK5Tk7L28ZbfGljo/mYfOo62OEanVT/uh7xKeSX67iN/XzAg9rPC'),
  (4,'doctor','Dr. Demo Doctor H04 054','doctor.h04.054@govcare.test','GCD-H04-DOC-054','govcare-demo-network-v1:h04:doctor:054','DEMO-WARD-054','$2a$10$QZ.3z3iFttAcddQdy8FXdOKsspcONwl0RRrQp9aV1x28a1JKAkHpq'),
  (4,'doctor','Dr. Demo Doctor H04 055','doctor.h04.055@govcare.test','GCD-H04-DOC-055','govcare-demo-network-v1:h04:doctor:055','DEMO-WARD-055','$2a$10$z/NkzxJkHowBDk1CLdBhcuJaBSKUJX/5g8.i0qpe9cKq0jKmB8pwq'),
  (4,'doctor','Dr. Demo Doctor H04 056','doctor.h04.056@govcare.test','GCD-H04-DOC-056','govcare-demo-network-v1:h04:doctor:056','DEMO-WARD-056','$2a$10$o0ngV0Ut4.c5JhdsVYh.k.bJ52o/3VfAoEOHURzoAV2PQ9D3WVwd2'),
  (4,'doctor','Dr. Demo Doctor H04 057','doctor.h04.057@govcare.test','GCD-H04-DOC-057','govcare-demo-network-v1:h04:doctor:057','DEMO-WARD-057','$2a$10$iq8b5z/EsVmRVuu8TGGCaenYx.FB9tPgZxiak9ufhjovHM40pO6z.'),
  (4,'doctor','Dr. Demo Doctor H04 058','doctor.h04.058@govcare.test','GCD-H04-DOC-058','govcare-demo-network-v1:h04:doctor:058','DEMO-WARD-058','$2a$10$W2mGmM4TaEo0ITSqdCXi4ut7qh.93KJ/7Zs/ZfPsPKz8/oRbokUUK'),
  (4,'doctor','Dr. Demo Doctor H04 059','doctor.h04.059@govcare.test','GCD-H04-DOC-059','govcare-demo-network-v1:h04:doctor:059','DEMO-WARD-059','$2a$10$5Cs4x5007bi375uQ4VQRWO7mUUJZ14yv.U/C7TNtiNpHfzxnKlHEi'),
  (4,'doctor','Dr. Demo Doctor H04 060','doctor.h04.060@govcare.test','GCD-H04-DOC-060','govcare-demo-network-v1:h04:doctor:060','DEMO-WARD-060','$2a$10$clqVJY989n4pXKVXHiMJQ.hGy9F5hjweboWvs8QWVy8F6IzyzoJia'),
  (4,'doctor','Dr. Demo Doctor H04 061','doctor.h04.061@govcare.test','GCD-H04-DOC-061','govcare-demo-network-v1:h04:doctor:061','DEMO-WARD-061','$2a$10$4BsvSejA7bmp7T4ICn22w.BadQeEwtwBBm2dydEFJRosYuwoGKxLi'),
  (4,'doctor','Dr. Demo Doctor H04 062','doctor.h04.062@govcare.test','GCD-H04-DOC-062','govcare-demo-network-v1:h04:doctor:062','DEMO-WARD-062','$2a$10$uunNiS21RHqjT9IdN/KrpO4gg732vjhzUuheWs7UChdtlHPRV8yay'),
  (4,'doctor','Dr. Demo Doctor H04 063','doctor.h04.063@govcare.test','GCD-H04-DOC-063','govcare-demo-network-v1:h04:doctor:063','DEMO-WARD-063','$2a$10$j92YzTFvDGP459VCjou7WODVqmtHoqAf0Mk6/.JfKQT1b4jF0MW0e'),
  (4,'doctor','Dr. Demo Doctor H04 064','doctor.h04.064@govcare.test','GCD-H04-DOC-064','govcare-demo-network-v1:h04:doctor:064','DEMO-WARD-064','$2a$10$tjO67vUj6rL04tN.C8.FZuXiyEVyWVI8RNI771g/H/X00mjCudQEK'),
  (4,'doctor','Dr. Demo Doctor H04 065','doctor.h04.065@govcare.test','GCD-H04-DOC-065','govcare-demo-network-v1:h04:doctor:065','DEMO-WARD-065','$2a$10$qwzr1495siCSpAGCcAyHA.P7mgxjIVDHJImTDaLcctZ9uSI3vk2ha'),
  (4,'doctor','Dr. Demo Doctor H04 066','doctor.h04.066@govcare.test','GCD-H04-DOC-066','govcare-demo-network-v1:h04:doctor:066','DEMO-WARD-066','$2a$10$fO4NoNSpRpwMiaJc8SeJuO8mnIX/Yh2wuJgZuD0rYIkJBgGMyPObO'),
  (4,'doctor','Dr. Demo Doctor H04 067','doctor.h04.067@govcare.test','GCD-H04-DOC-067','govcare-demo-network-v1:h04:doctor:067','DEMO-WARD-067','$2a$10$r6G0swmauiyalUrJ//omaeG5OejbDeJaw2nMIQFlyCitjqe58Vz0u'),
  (4,'doctor','Dr. Demo Doctor H04 068','doctor.h04.068@govcare.test','GCD-H04-DOC-068','govcare-demo-network-v1:h04:doctor:068','DEMO-WARD-068','$2a$10$LnB9nMpKj5b.p.a6sZ29kewKC0Nge3gsxVVzqcZcIe.LkTKHAsZ1e'),
  (4,'doctor','Dr. Demo Doctor H04 069','doctor.h04.069@govcare.test','GCD-H04-DOC-069','govcare-demo-network-v1:h04:doctor:069','DEMO-WARD-069','$2a$10$d5u84Eq.C9Yud462EAY41.sJ6AcLfLnaAil//IDeYCKV66TV3cLQm'),
  (4,'doctor','Dr. Demo Doctor H04 070','doctor.h04.070@govcare.test','GCD-H04-DOC-070','govcare-demo-network-v1:h04:doctor:070','DEMO-WARD-070','$2a$10$D6PRowW6.7niQXldXBiY1eI8iD6Y83H.RJfDfRR9og0BhXj4tdaGG'),
  (4,'doctor','Dr. Demo Doctor H04 071','doctor.h04.071@govcare.test','GCD-H04-DOC-071','govcare-demo-network-v1:h04:doctor:071','DEMO-WARD-071','$2a$10$S4m23iJQQSrHca5x8bo64.Z/gRvWqJGFmbEat8QY7OzyEQqb7o9QO'),
  (4,'doctor','Dr. Demo Doctor H04 072','doctor.h04.072@govcare.test','GCD-H04-DOC-072','govcare-demo-network-v1:h04:doctor:072','DEMO-WARD-072','$2a$10$GpI2OxRv.VaKFcdiH/wc9ud2vFKxzugeqJVUrvq7mcx015c52FZIK'),
  (4,'doctor','Dr. Demo Doctor H04 073','doctor.h04.073@govcare.test','GCD-H04-DOC-073','govcare-demo-network-v1:h04:doctor:073','DEMO-WARD-073','$2a$10$zs.4n3RPDB/0lTYosHh/3uxtjHRkd9qKKSjr02lg/tzFJca93oIK6'),
  (4,'doctor','Dr. Demo Doctor H04 074','doctor.h04.074@govcare.test','GCD-H04-DOC-074','govcare-demo-network-v1:h04:doctor:074','DEMO-WARD-074','$2a$10$qgMvMKcWUUP41qJmSe0Hfu.pmSSk1yQN.jz7wbNrEcElwfwl1A.iq'),
  (4,'doctor','Dr. Demo Doctor H04 075','doctor.h04.075@govcare.test','GCD-H04-DOC-075','govcare-demo-network-v1:h04:doctor:075','DEMO-WARD-075','$2a$10$HjIBpsgJdsN9FqOKFyuBK.oljgR//4UI/rUQtstGf7XMbkpDGgoaa'),
  (4,'doctor','Dr. Demo Doctor H04 076','doctor.h04.076@govcare.test','GCD-H04-DOC-076','govcare-demo-network-v1:h04:doctor:076','DEMO-WARD-076','$2a$10$Z2TGbpusFZBvubVWyKR9ouT.i3ViYnDAD8WEtwf3q9eO03VkygXPm'),
  (4,'doctor','Dr. Demo Doctor H04 077','doctor.h04.077@govcare.test','GCD-H04-DOC-077','govcare-demo-network-v1:h04:doctor:077','DEMO-WARD-077','$2a$10$cX32a.bpjj5jLHcPSKfzKurnKgBikUPNeK1YriD3PkcMZbYs9DLMG'),
  (4,'doctor','Dr. Demo Doctor H04 078','doctor.h04.078@govcare.test','GCD-H04-DOC-078','govcare-demo-network-v1:h04:doctor:078','DEMO-WARD-078','$2a$10$9Ig98vEgtw7NkTN5QwZZoO4F/lZL.TSI9d8Z.9h1U9j4vYRFzgQgW'),
  (4,'doctor','Dr. Demo Doctor H04 079','doctor.h04.079@govcare.test','GCD-H04-DOC-079','govcare-demo-network-v1:h04:doctor:079','DEMO-WARD-079','$2a$10$AKlXW0lgzlqVmfMKLjCaV.7HE8MtI9a56qmp2d3BPHTRifcuhqeWa'),
  (4,'doctor','Dr. Demo Doctor H04 080','doctor.h04.080@govcare.test','GCD-H04-DOC-080','govcare-demo-network-v1:h04:doctor:080','DEMO-WARD-080','$2a$10$9KHOFr/LEBSKoYCFNhMgwOr0fcW6kYkHMGTcUqTzqI1YqiboWl05e'),
  (4,'doctor','Dr. Demo Doctor H04 081','doctor.h04.081@govcare.test','GCD-H04-DOC-081','govcare-demo-network-v1:h04:doctor:081','DEMO-WARD-081','$2a$10$lqeXLKjYmcV9iYBPbr1YF.r23VaIsd8q1iIPUEGxV2x8RxGOVKe.S'),
  (4,'doctor','Dr. Demo Doctor H04 082','doctor.h04.082@govcare.test','GCD-H04-DOC-082','govcare-demo-network-v1:h04:doctor:082','DEMO-WARD-082','$2a$10$hLPgV3a2ghZrnGWRxk/A8.yw1m7Ru62pUSdgBBCXChbg/Qz.nskcS'),
  (4,'doctor','Dr. Demo Doctor H04 083','doctor.h04.083@govcare.test','GCD-H04-DOC-083','govcare-demo-network-v1:h04:doctor:083','DEMO-WARD-083','$2a$10$NU/IaoJyvSSYkYUJPg6wEeGIRiMPt7akaV1VNlX78rUF4Jkloznni'),
  (4,'doctor','Dr. Demo Doctor H04 084','doctor.h04.084@govcare.test','GCD-H04-DOC-084','govcare-demo-network-v1:h04:doctor:084','DEMO-WARD-084','$2a$10$EmEg3BJqQTZ.sN6/u29XN.HhLPzuVDSB99eHcmox8i6cKGx5WJbGe'),
  (4,'doctor','Dr. Demo Doctor H04 085','doctor.h04.085@govcare.test','GCD-H04-DOC-085','govcare-demo-network-v1:h04:doctor:085','DEMO-WARD-085','$2a$10$Wo2F/XJiHTyWkfOdEW5ABOZAaqv5fiQD4c4eroIF7ul2ZkeWk9Pdu'),
  (4,'doctor','Dr. Demo Doctor H04 086','doctor.h04.086@govcare.test','GCD-H04-DOC-086','govcare-demo-network-v1:h04:doctor:086','DEMO-WARD-086','$2a$10$1cOGLmoJ7Z40hMhIiTkTM.ZyAitFCbRuXUFO6T4vv4DXMlhN5s6q2'),
  (4,'doctor','Dr. Demo Doctor H04 087','doctor.h04.087@govcare.test','GCD-H04-DOC-087','govcare-demo-network-v1:h04:doctor:087','DEMO-WARD-087','$2a$10$0e.Z93Wa.ZT4IbZZD/pncOI7xk06nETdYXtkq4PY92KDRk/QW6Zf2'),
  (4,'doctor','Dr. Demo Doctor H04 088','doctor.h04.088@govcare.test','GCD-H04-DOC-088','govcare-demo-network-v1:h04:doctor:088','DEMO-WARD-088','$2a$10$YCvbNpEI7/KEe.1CeOZtT.Jbjdpuh0bBBRbdhKQ1cxckWMtMF5TKK'),
  (4,'doctor','Dr. Demo Doctor H04 089','doctor.h04.089@govcare.test','GCD-H04-DOC-089','govcare-demo-network-v1:h04:doctor:089','DEMO-WARD-089','$2a$10$wgMy5zxNlelNFVvqgpamiekJOsnfX0FjoIINvyI0mnhcJ/6N7tFbO'),
  (4,'doctor','Dr. Demo Doctor H04 090','doctor.h04.090@govcare.test','GCD-H04-DOC-090','govcare-demo-network-v1:h04:doctor:090','DEMO-WARD-090','$2a$10$SiFuR6C4uIfFnC/HrBSiIeir5ctlyOJ/ULWEFeGOsyZwj2hFCm9NS'),
  (4,'doctor','Dr. Demo Doctor H04 091','doctor.h04.091@govcare.test','GCD-H04-DOC-091','govcare-demo-network-v1:h04:doctor:091','DEMO-WARD-091','$2a$10$hu/2B0aECTiPq1yHkH1YneWiBtiL6jrbR5ZcS0H4.Iafa1KQ8wany'),
  (4,'doctor','Dr. Demo Doctor H04 092','doctor.h04.092@govcare.test','GCD-H04-DOC-092','govcare-demo-network-v1:h04:doctor:092','DEMO-WARD-092','$2a$10$LENNXM98yaIX2DtQwrp8X.xSrJLl5zwTcRk0Du4TBrl.KI9aDvAVK'),
  (4,'doctor','Dr. Demo Doctor H04 093','doctor.h04.093@govcare.test','GCD-H04-DOC-093','govcare-demo-network-v1:h04:doctor:093','DEMO-WARD-093','$2a$10$y5i2cdBklqWZaASnAJ.3euH9FjQXbrxKJujw3sfyk.xKYkpHd9kD2'),
  (4,'doctor','Dr. Demo Doctor H04 094','doctor.h04.094@govcare.test','GCD-H04-DOC-094','govcare-demo-network-v1:h04:doctor:094','DEMO-WARD-094','$2a$10$ptaK.xIpbKF8p9ZG.db/X.OvG/BLJVEhgKMF5935Kg6rMOwvsvB/2'),
  (4,'doctor','Dr. Demo Doctor H04 095','doctor.h04.095@govcare.test','GCD-H04-DOC-095','govcare-demo-network-v1:h04:doctor:095','DEMO-WARD-095','$2a$10$pcmT9ab5EFXTZA46TiYRsO5O9/bjaYYn6Mpoa10u1cPHCkLnCmdKi'),
  (4,'doctor','Dr. Demo Doctor H04 096','doctor.h04.096@govcare.test','GCD-H04-DOC-096','govcare-demo-network-v1:h04:doctor:096','DEMO-WARD-096','$2a$10$jtKVvgS0UiN6L5bDQa4foeIVs6cQKgRz5h.nCOiS8eP6WTvac3ssy'),
  (4,'doctor','Dr. Demo Doctor H04 097','doctor.h04.097@govcare.test','GCD-H04-DOC-097','govcare-demo-network-v1:h04:doctor:097','DEMO-WARD-097','$2a$10$3cQ.GuXW90eTiAl6.DM0IemMQCqpY7NQDqRAeF5IoM8JJBFTeb4wG'),
  (4,'doctor','Dr. Demo Doctor H04 098','doctor.h04.098@govcare.test','GCD-H04-DOC-098','govcare-demo-network-v1:h04:doctor:098','DEMO-WARD-098','$2a$10$iQRODg2lRHUgygYKsLmjUOYcQWFHISBht4jj0iaZ0sau1oz0Rza4q'),
  (4,'doctor','Dr. Demo Doctor H04 099','doctor.h04.099@govcare.test','GCD-H04-DOC-099','govcare-demo-network-v1:h04:doctor:099','DEMO-WARD-099','$2a$10$X8oq0x.ce8QDShA3jwTcpuFXfScK4yHTc84y.5UdJEuZoD91wX2vK'),
  (4,'doctor','Dr. Demo Doctor H04 100','doctor.h04.100@govcare.test','GCD-H04-DOC-100','govcare-demo-network-v1:h04:doctor:100','DEMO-WARD-100','$2a$10$21QLDcz5lqGeG3gIMt1ISObsyAXG2XnNlf8EASDZ3VQJAfM1nQXz2'),
  (4,'hospital_admin','Demo Hospital Admin H04','admin.h04@govcare.test','GCD-H04-ADMIN','govcare-demo-network-v1:h04:hospital_admin','ADMIN','$2a$10$sbhcUn5nxvTiObIKFcWI7.vEdwy1Fpc5wFRlR6MwEay.b70W9VNOC'),
  (4,'receptionist','Demo Front Desk Officer H04','reception.h04@govcare.test','GCD-H04-RECEPTION','govcare-demo-network-v1:h04:receptionist','RECEPTION','$2a$10$Cun5xKnrirrv9pf.sDv9v.hlcXvbRTHzgPNZyEk2ei4MWKYZymhwa'),
  (4,'nurse','Demo Nurse H04','nurse.h04@govcare.test','GCD-H04-NURSE','govcare-demo-network-v1:h04:nurse','DEMO-WARD-001','$2a$10$yzDC3bIijXpgMwVkTBc2Mu1QjM420edS2GxJHhD5W616yMaiq.lJC'),
  (4,'ward_manager','Demo Ward Manager H04','wardmanager.h04@govcare.test','GCD-H04-WARDMANAGER','govcare-demo-network-v1:h04:ward_manager','DEMO-WARD-001','$2a$10$SrcsyduDYNEX9gRQ6DGCe.4JLx0pw6S/EOhF8I6kkUCqJGyVTGD7a'),
  (4,'patient','Demo Patient Portal User H04','patient.h04@govcare.test','GCD-H04-PATIENT','govcare-demo-network-v1:h04:patient',null,'$2a$10$N1CdodBn6KQ3.MvKeZWm.ez.naaLQ1FJ34iKCGkTEBbGnctVsB5fG'),
  (4,'guardian','Demo Guardian Portal User H04','guardian.h04@govcare.test','GCD-H04-GUARDIAN','govcare-demo-network-v1:h04:guardian',null,'$2a$10$uOI5waw5r5OS5D2dKOTk2u1N3NI.197zDoSTc2PuOHarKWIV4EUoW'),
  (5,'doctor','Dr. Demo Doctor H05 001','doctor.h05.001@govcare.test','GCD-H05-DOC-001','govcare-demo-network-v1:h05:doctor:001','DEMO-WARD-001','$2a$10$ZMFignX16ePZ6vIrRjtGMu1aQjpxSevXkQ4x2Si6G0gf7PgnxlvNi'),
  (5,'doctor','Dr. Demo Doctor H05 002','doctor.h05.002@govcare.test','GCD-H05-DOC-002','govcare-demo-network-v1:h05:doctor:002','DEMO-WARD-002','$2a$10$YcX8xCPhnkiuSKkuTjg0iuac3YAhwT9v8wWa50.aSPZHyEl0WwOny'),
  (5,'doctor','Dr. Demo Doctor H05 003','doctor.h05.003@govcare.test','GCD-H05-DOC-003','govcare-demo-network-v1:h05:doctor:003','DEMO-WARD-003','$2a$10$cilC2ObLE1TaU0LBDvcvVuBvK9fcBtCoF7oHwgdYRuSd86dGC4ouC'),
  (5,'doctor','Dr. Demo Doctor H05 004','doctor.h05.004@govcare.test','GCD-H05-DOC-004','govcare-demo-network-v1:h05:doctor:004','DEMO-WARD-004','$2a$10$qpT41THgwpy9PE3YIdtFeeXthjEjcgjiWCaVm7uW.KPPMFAwsbB9W'),
  (5,'doctor','Dr. Demo Doctor H05 005','doctor.h05.005@govcare.test','GCD-H05-DOC-005','govcare-demo-network-v1:h05:doctor:005','DEMO-WARD-005','$2a$10$Vm2fQqxl1HrExVroIoDtZOTkqgsLG.RKGYaiD7ZNpNsWMLLeRPLFW'),
  (5,'doctor','Dr. Demo Doctor H05 006','doctor.h05.006@govcare.test','GCD-H05-DOC-006','govcare-demo-network-v1:h05:doctor:006','DEMO-WARD-006','$2a$10$4HEaSs0BNfsMLhpPrBGZOeTSpvmNbzc.1JKsgnxCQeOThSVw/DHCu'),
  (5,'doctor','Dr. Demo Doctor H05 007','doctor.h05.007@govcare.test','GCD-H05-DOC-007','govcare-demo-network-v1:h05:doctor:007','DEMO-WARD-007','$2a$10$IDNgbi22wheagJBhyo0Nrut6sGlysHbNVc7Qr.pzfYdwKOt5VGd5.'),
  (5,'doctor','Dr. Demo Doctor H05 008','doctor.h05.008@govcare.test','GCD-H05-DOC-008','govcare-demo-network-v1:h05:doctor:008','DEMO-WARD-008','$2a$10$G6gd6/43f4ttAr1Q3HazPuPFxLZ9/bJE0cCgV5JjHNtoE2eQY97vO'),
  (5,'doctor','Dr. Demo Doctor H05 009','doctor.h05.009@govcare.test','GCD-H05-DOC-009','govcare-demo-network-v1:h05:doctor:009','DEMO-WARD-009','$2a$10$bSm3IP36V6nlRIflFpftZuNWBdY0zTTnAWFnyr0JUkydfKmMxfd5q'),
  (5,'doctor','Dr. Demo Doctor H05 010','doctor.h05.010@govcare.test','GCD-H05-DOC-010','govcare-demo-network-v1:h05:doctor:010','DEMO-WARD-010','$2a$10$1kuMdfCqhoeoWIJgWo7hguHS5m0hFQgFekGwy4HNVk87JzDi/DUkW'),
  (5,'doctor','Dr. Demo Doctor H05 011','doctor.h05.011@govcare.test','GCD-H05-DOC-011','govcare-demo-network-v1:h05:doctor:011','DEMO-WARD-011','$2a$10$GRbPka25s2ut9hHVs5zepuWWXpa2.v9T8zOdxfQ9xbq/AxM116hee'),
  (5,'doctor','Dr. Demo Doctor H05 012','doctor.h05.012@govcare.test','GCD-H05-DOC-012','govcare-demo-network-v1:h05:doctor:012','DEMO-WARD-012','$2a$10$L.GNNrEXTX4hCDbHs1HKEumTaLbNAxDuWujyCL3w5PdZG5tKwZuY.'),
  (5,'doctor','Dr. Demo Doctor H05 013','doctor.h05.013@govcare.test','GCD-H05-DOC-013','govcare-demo-network-v1:h05:doctor:013','DEMO-WARD-013','$2a$10$X7Th0KJdTU.lNm9BY8cWyOM2ZI0oylRFoAYzVw3tsKXqchtlTUeC2'),
  (5,'doctor','Dr. Demo Doctor H05 014','doctor.h05.014@govcare.test','GCD-H05-DOC-014','govcare-demo-network-v1:h05:doctor:014','DEMO-WARD-014','$2a$10$MymTehs5GoiY0Py8ae/fDO3K7SKzIf.jW3i1UoSi37ZprHjeQaxoC'),
  (5,'doctor','Dr. Demo Doctor H05 015','doctor.h05.015@govcare.test','GCD-H05-DOC-015','govcare-demo-network-v1:h05:doctor:015','DEMO-WARD-015','$2a$10$8SUDi0mqNZ3duhAD6uaPw.gjOYiQQ6eyk5tw0O7I80D5naXcBo4wG'),
  (5,'doctor','Dr. Demo Doctor H05 016','doctor.h05.016@govcare.test','GCD-H05-DOC-016','govcare-demo-network-v1:h05:doctor:016','DEMO-WARD-016','$2a$10$ReT70xUfV3d5ijUhj5bUe.YZLhyN/Czdpd1gQCQVkHLf04T5NCYYm'),
  (5,'doctor','Dr. Demo Doctor H05 017','doctor.h05.017@govcare.test','GCD-H05-DOC-017','govcare-demo-network-v1:h05:doctor:017','DEMO-WARD-017','$2a$10$EZ3mlnrE/ExUQwIuUUtzHOp1QnCADOVs9uAPHx10b2W4idyEHerma'),
  (5,'doctor','Dr. Demo Doctor H05 018','doctor.h05.018@govcare.test','GCD-H05-DOC-018','govcare-demo-network-v1:h05:doctor:018','DEMO-WARD-018','$2a$10$Ap7EiFWj8klrOd3wf9s3I./r8lprgLmfVTm9eDHmE4GWWiACLWjQW'),
  (5,'doctor','Dr. Demo Doctor H05 019','doctor.h05.019@govcare.test','GCD-H05-DOC-019','govcare-demo-network-v1:h05:doctor:019','DEMO-WARD-019','$2a$10$gPILeH96Z54D5tNSsOA6UevhakDAUx9uTlVWGg1PJpS3lKahA..AC'),
  (5,'doctor','Dr. Demo Doctor H05 020','doctor.h05.020@govcare.test','GCD-H05-DOC-020','govcare-demo-network-v1:h05:doctor:020','DEMO-WARD-020','$2a$10$eFfbSkKiodI4aMFuGynNkOI2xp6WfMgb/X9/FMXbiXtmZOQWH75tq'),
  (5,'doctor','Dr. Demo Doctor H05 021','doctor.h05.021@govcare.test','GCD-H05-DOC-021','govcare-demo-network-v1:h05:doctor:021','DEMO-WARD-021','$2a$10$FXtK8c7eUA4R515pBdVo6ORxJh/QqwRRpstZnhjESqNYzQH0qTx9e'),
  (5,'doctor','Dr. Demo Doctor H05 022','doctor.h05.022@govcare.test','GCD-H05-DOC-022','govcare-demo-network-v1:h05:doctor:022','DEMO-WARD-022','$2a$10$qVt3vYDeWinvY/jXnpUhuuiWO6TUKmGnfaNLMw4KnaRqNr2dYoMAi'),
  (5,'doctor','Dr. Demo Doctor H05 023','doctor.h05.023@govcare.test','GCD-H05-DOC-023','govcare-demo-network-v1:h05:doctor:023','DEMO-WARD-023','$2a$10$4EmlVx9HirQ/IX5S.yITnOm6SQR4DKiwWZAbFC/.JI1R6j.0m/9dW'),
  (5,'doctor','Dr. Demo Doctor H05 024','doctor.h05.024@govcare.test','GCD-H05-DOC-024','govcare-demo-network-v1:h05:doctor:024','DEMO-WARD-024','$2a$10$f2XPg15FpS1GkHO0sBhZGuPydg9or48I.auyVSPSSIbh7lcQacmYq'),
  (5,'doctor','Dr. Demo Doctor H05 025','doctor.h05.025@govcare.test','GCD-H05-DOC-025','govcare-demo-network-v1:h05:doctor:025','DEMO-WARD-025','$2a$10$5gzI0FqugNISi9rr.Y2KZu.PUHXKHD/9n1LIOmt0xJrszyHKKZsPy'),
  (5,'doctor','Dr. Demo Doctor H05 026','doctor.h05.026@govcare.test','GCD-H05-DOC-026','govcare-demo-network-v1:h05:doctor:026','DEMO-WARD-026','$2a$10$sZQrWR81GIKtexfqXUVWruIVqX8rzvdeTXnw/YeyoTgokJLNy.70y'),
  (5,'doctor','Dr. Demo Doctor H05 027','doctor.h05.027@govcare.test','GCD-H05-DOC-027','govcare-demo-network-v1:h05:doctor:027','DEMO-WARD-027','$2a$10$cSRhfT0c8L76O385JPmCcOFtNWUGkXV5u1qx1JFYT4KiSZNRiClxy'),
  (5,'doctor','Dr. Demo Doctor H05 028','doctor.h05.028@govcare.test','GCD-H05-DOC-028','govcare-demo-network-v1:h05:doctor:028','DEMO-WARD-028','$2a$10$/.CkRQyJzV48D/23If5a8.zCM.Me06tR13eDqBonr6Mu98QIny/6i'),
  (5,'doctor','Dr. Demo Doctor H05 029','doctor.h05.029@govcare.test','GCD-H05-DOC-029','govcare-demo-network-v1:h05:doctor:029','DEMO-WARD-029','$2a$10$JaBlr2.2Z0.vC9Lq07LOJ.2LtczJbQwvG.8cXeEKMkvZQCykX/WNi'),
  (5,'doctor','Dr. Demo Doctor H05 030','doctor.h05.030@govcare.test','GCD-H05-DOC-030','govcare-demo-network-v1:h05:doctor:030','DEMO-WARD-030','$2a$10$GAbFm/8WoiltON5MHqjn4eA.gf6tbjt0ZpfXYnB7L2dVl84OOn35C'),
  (5,'doctor','Dr. Demo Doctor H05 031','doctor.h05.031@govcare.test','GCD-H05-DOC-031','govcare-demo-network-v1:h05:doctor:031','DEMO-WARD-031','$2a$10$k82xAMWRV5FPzpE5gtlR2eARXqx0BeiuQ0/tQJTMAhAbHH5KMzyzu'),
  (5,'doctor','Dr. Demo Doctor H05 032','doctor.h05.032@govcare.test','GCD-H05-DOC-032','govcare-demo-network-v1:h05:doctor:032','DEMO-WARD-032','$2a$10$sQU9gV3Lgk3ghKK0EuPymOWA6bg9r2dDH45pE.xV.MUL8O5LQSAW6'),
  (5,'doctor','Dr. Demo Doctor H05 033','doctor.h05.033@govcare.test','GCD-H05-DOC-033','govcare-demo-network-v1:h05:doctor:033','DEMO-WARD-033','$2a$10$gRo3c/SjoJUWZWaatywr.e1OKbhVTzHOZ/so.B4W/FgHrKxMHI8KS'),
  (5,'doctor','Dr. Demo Doctor H05 034','doctor.h05.034@govcare.test','GCD-H05-DOC-034','govcare-demo-network-v1:h05:doctor:034','DEMO-WARD-034','$2a$10$A/fSgGPO8HMNiSTR4M79X.PB4kvv/WZr29kDEQixociVPwlwV8x2G'),
  (5,'doctor','Dr. Demo Doctor H05 035','doctor.h05.035@govcare.test','GCD-H05-DOC-035','govcare-demo-network-v1:h05:doctor:035','DEMO-WARD-035','$2a$10$/z8JEa5i/eBLDgNhD5o3FOIePzTZA.2oGxM6P4rBDctLR2ypnWqxS'),
  (5,'doctor','Dr. Demo Doctor H05 036','doctor.h05.036@govcare.test','GCD-H05-DOC-036','govcare-demo-network-v1:h05:doctor:036','DEMO-WARD-036','$2a$10$bCyCGC6gn21pjbQA0WbcQue6vh3nzhCFPNJjKwlii5IwI5FxRJXFi'),
  (5,'doctor','Dr. Demo Doctor H05 037','doctor.h05.037@govcare.test','GCD-H05-DOC-037','govcare-demo-network-v1:h05:doctor:037','DEMO-WARD-037','$2a$10$JFqcoqy6loJLI2Fm6V/HAuAVkkkOnYvciXt3rqxZY9FqiPH67PEsa'),
  (5,'doctor','Dr. Demo Doctor H05 038','doctor.h05.038@govcare.test','GCD-H05-DOC-038','govcare-demo-network-v1:h05:doctor:038','DEMO-WARD-038','$2a$10$ve2PMfdEFefqcLWOUtidmuMb0TaeEjKYE7Jt/o2pDt/p46oFXnWI6'),
  (5,'doctor','Dr. Demo Doctor H05 039','doctor.h05.039@govcare.test','GCD-H05-DOC-039','govcare-demo-network-v1:h05:doctor:039','DEMO-WARD-039','$2a$10$x7aA5bBh8q.Sg2Lbcj423emFUOmlNdwC1UuDeXS3HVgtKUC6XRZCC'),
  (5,'doctor','Dr. Demo Doctor H05 040','doctor.h05.040@govcare.test','GCD-H05-DOC-040','govcare-demo-network-v1:h05:doctor:040','DEMO-WARD-040','$2a$10$7CF7.cVahwiv9DB0/J0wH.si8WmC1xGFfwBOgVEAHVItVAdb5jkYu'),
  (5,'doctor','Dr. Demo Doctor H05 041','doctor.h05.041@govcare.test','GCD-H05-DOC-041','govcare-demo-network-v1:h05:doctor:041','DEMO-WARD-041','$2a$10$gZP7FHXhYAstcVHdIi3KUuF9HQdyfxPt3vi4th7OZUfPDecIsPp6G'),
  (5,'doctor','Dr. Demo Doctor H05 042','doctor.h05.042@govcare.test','GCD-H05-DOC-042','govcare-demo-network-v1:h05:doctor:042','DEMO-WARD-042','$2a$10$.1O/cADjt2.92iarW4xrN.RRDhf2S3HxrXRYkBssiIFIhIYrsGFtm'),
  (5,'doctor','Dr. Demo Doctor H05 043','doctor.h05.043@govcare.test','GCD-H05-DOC-043','govcare-demo-network-v1:h05:doctor:043','DEMO-WARD-043','$2a$10$CEqhyziBcDvfZecvCyz0euaIzeYFpdOTtZRuNm3mFrCLWBrcQDaSi'),
  (5,'doctor','Dr. Demo Doctor H05 044','doctor.h05.044@govcare.test','GCD-H05-DOC-044','govcare-demo-network-v1:h05:doctor:044','DEMO-WARD-044','$2a$10$sIvlQ8YS2s4JlMLpE8TuAuavW1pdsX5kvmkwdqVnafGdSU0FoHKWq'),
  (5,'doctor','Dr. Demo Doctor H05 045','doctor.h05.045@govcare.test','GCD-H05-DOC-045','govcare-demo-network-v1:h05:doctor:045','DEMO-WARD-045','$2a$10$HYl7X9obcs..HRNgLj/kW.feA/0S5zoFUciDSUvjCRT5x84Yr6C7O'),
  (5,'doctor','Dr. Demo Doctor H05 046','doctor.h05.046@govcare.test','GCD-H05-DOC-046','govcare-demo-network-v1:h05:doctor:046','DEMO-WARD-046','$2a$10$fc5AIdEPSap3kDqZVIxYoe2r6wspj7xDUQZsntsKUTkboaF5oRYum'),
  (5,'doctor','Dr. Demo Doctor H05 047','doctor.h05.047@govcare.test','GCD-H05-DOC-047','govcare-demo-network-v1:h05:doctor:047','DEMO-WARD-047','$2a$10$wZlD9rbyPgo7e/Mit0P/buWTCQLZbvv.seTDAXW2rrLSF/jKGDMii'),
  (5,'doctor','Dr. Demo Doctor H05 048','doctor.h05.048@govcare.test','GCD-H05-DOC-048','govcare-demo-network-v1:h05:doctor:048','DEMO-WARD-048','$2a$10$pafAbYTQ5cdlzxQT37wEFu6U/tSf88Y/DcuitFQ2zNLxWfODC5DY2'),
  (5,'doctor','Dr. Demo Doctor H05 049','doctor.h05.049@govcare.test','GCD-H05-DOC-049','govcare-demo-network-v1:h05:doctor:049','DEMO-WARD-049','$2a$10$GaJ0X2oFLcmwALYe4xBaR.L8W4NH1Kr14WcQWZKqJXPvZlkndTPR2'),
  (5,'doctor','Dr. Demo Doctor H05 050','doctor.h05.050@govcare.test','GCD-H05-DOC-050','govcare-demo-network-v1:h05:doctor:050','DEMO-WARD-050','$2a$10$khXX5CnerlaoEnx/GPdJA.TgpxlDh5xeQi2f5qzlJzzgd0fZpetcm'),
  (5,'doctor','Dr. Demo Doctor H05 051','doctor.h05.051@govcare.test','GCD-H05-DOC-051','govcare-demo-network-v1:h05:doctor:051','DEMO-WARD-051','$2a$10$SVGlHQ7Zsi5xJ56DEsjZd.MgQRBrGlV4jvzkVnY3DCZSAVaG.j9f.'),
  (5,'doctor','Dr. Demo Doctor H05 052','doctor.h05.052@govcare.test','GCD-H05-DOC-052','govcare-demo-network-v1:h05:doctor:052','DEMO-WARD-052','$2a$10$n.fHyifcbiiRhCkBxSweuOHe8.k/BbVGkmDsZO2TIYraPhhCY3Ny6'),
  (5,'doctor','Dr. Demo Doctor H05 053','doctor.h05.053@govcare.test','GCD-H05-DOC-053','govcare-demo-network-v1:h05:doctor:053','DEMO-WARD-053','$2a$10$Ya12u1zY8B372WSlcifDeen.fYoSVn0IOQUsA6i8GNVnTLjXAC2Qm'),
  (5,'doctor','Dr. Demo Doctor H05 054','doctor.h05.054@govcare.test','GCD-H05-DOC-054','govcare-demo-network-v1:h05:doctor:054','DEMO-WARD-054','$2a$10$LudVrVe7L/IL5XA9LvpZWexeP4KhorjMkOqlFyKo3a6j4AMiPHgOu'),
  (5,'doctor','Dr. Demo Doctor H05 055','doctor.h05.055@govcare.test','GCD-H05-DOC-055','govcare-demo-network-v1:h05:doctor:055','DEMO-WARD-055','$2a$10$vDdc9jl2.VXVw6cAEaJtY.GROCJoTunFGsyOrDiJiMTZOEWokOMYq'),
  (5,'doctor','Dr. Demo Doctor H05 056','doctor.h05.056@govcare.test','GCD-H05-DOC-056','govcare-demo-network-v1:h05:doctor:056','DEMO-WARD-056','$2a$10$XNRbw.3PVhLhu9CtdhJ1Oeel6i5A8oevALNpRe2oR0836jNOCalQa'),
  (5,'doctor','Dr. Demo Doctor H05 057','doctor.h05.057@govcare.test','GCD-H05-DOC-057','govcare-demo-network-v1:h05:doctor:057','DEMO-WARD-057','$2a$10$/Da0Hjyaedpolcgc179gOe2AVspOjK/gv.OZhXppRvPJskPYq1WyG'),
  (5,'doctor','Dr. Demo Doctor H05 058','doctor.h05.058@govcare.test','GCD-H05-DOC-058','govcare-demo-network-v1:h05:doctor:058','DEMO-WARD-058','$2a$10$phn.mDiyh1lcRYE8m6kk2.Ev3LO/V.PNqsK/8GTDxxR9Xg5GKluMW'),
  (5,'doctor','Dr. Demo Doctor H05 059','doctor.h05.059@govcare.test','GCD-H05-DOC-059','govcare-demo-network-v1:h05:doctor:059','DEMO-WARD-059','$2a$10$NTQv3q2nIcQmErGIVIn5bujHwG4KTZTwxKQ.4xpM1G1Yj.Fp6hqEK'),
  (5,'doctor','Dr. Demo Doctor H05 060','doctor.h05.060@govcare.test','GCD-H05-DOC-060','govcare-demo-network-v1:h05:doctor:060','DEMO-WARD-060','$2a$10$OFz1J8TAMaEYUS6DboNcrOj6AHr/b2ByySA8du8fhivmILmKKPavy'),
  (5,'doctor','Dr. Demo Doctor H05 061','doctor.h05.061@govcare.test','GCD-H05-DOC-061','govcare-demo-network-v1:h05:doctor:061','DEMO-WARD-061','$2a$10$0IDN/6E4Frahm/w0bRHsuOxn1CAoipDcb8jYrMTMQYO8Dueg262zW'),
  (5,'doctor','Dr. Demo Doctor H05 062','doctor.h05.062@govcare.test','GCD-H05-DOC-062','govcare-demo-network-v1:h05:doctor:062','DEMO-WARD-062','$2a$10$IwwuOKVdhoO2kz2neBcGdeyaI7BNP2gUdc9UtbPLySlVITw1Juchu'),
  (5,'doctor','Dr. Demo Doctor H05 063','doctor.h05.063@govcare.test','GCD-H05-DOC-063','govcare-demo-network-v1:h05:doctor:063','DEMO-WARD-063','$2a$10$LOalBKp4kwvj0wQh87xbaO6.whmFDFXwoPNcbuZ1XsLmDtOrwa0tC'),
  (5,'doctor','Dr. Demo Doctor H05 064','doctor.h05.064@govcare.test','GCD-H05-DOC-064','govcare-demo-network-v1:h05:doctor:064','DEMO-WARD-064','$2a$10$C3LzzgeG9kXl6GvhaaUeaOWWkJT0sj3n/Sz3brNJcli10VvYx6Fsa'),
  (5,'doctor','Dr. Demo Doctor H05 065','doctor.h05.065@govcare.test','GCD-H05-DOC-065','govcare-demo-network-v1:h05:doctor:065','DEMO-WARD-065','$2a$10$eYmtCPiYq1cNIMUtMCZ7oeT9gVIW.dYBENT/WGAI6C2IRNSFNjAFC'),
  (5,'doctor','Dr. Demo Doctor H05 066','doctor.h05.066@govcare.test','GCD-H05-DOC-066','govcare-demo-network-v1:h05:doctor:066','DEMO-WARD-066','$2a$10$m5eMrHazNB56L.5MTWlNeuCPaeVvQqcYw3uVTJ.srQ2f29VTcH8Te'),
  (5,'doctor','Dr. Demo Doctor H05 067','doctor.h05.067@govcare.test','GCD-H05-DOC-067','govcare-demo-network-v1:h05:doctor:067','DEMO-WARD-067','$2a$10$m6rD7NZJc1o0LCKZcCXcAeieUi1fDRnz/EO9YWjMrIhRArnqFvY5G'),
  (5,'doctor','Dr. Demo Doctor H05 068','doctor.h05.068@govcare.test','GCD-H05-DOC-068','govcare-demo-network-v1:h05:doctor:068','DEMO-WARD-068','$2a$10$RYPyUV/wI8IQc/uU1pFbEu0gpqT2f/mrJXTTonUCuaipODUgOzRsy'),
  (5,'doctor','Dr. Demo Doctor H05 069','doctor.h05.069@govcare.test','GCD-H05-DOC-069','govcare-demo-network-v1:h05:doctor:069','DEMO-WARD-069','$2a$10$1pwEYB7eQA8iZ3RH83kvy.wFRK2dY.syNK.a95mLdRQ2UZ.MizrFe'),
  (5,'doctor','Dr. Demo Doctor H05 070','doctor.h05.070@govcare.test','GCD-H05-DOC-070','govcare-demo-network-v1:h05:doctor:070','DEMO-WARD-070','$2a$10$1pR99S6eAcIxOd7GQ.w9A.Vc8RVv/PJLMjCU2a1qbygfwA1.KBJma'),
  (5,'doctor','Dr. Demo Doctor H05 071','doctor.h05.071@govcare.test','GCD-H05-DOC-071','govcare-demo-network-v1:h05:doctor:071','DEMO-WARD-071','$2a$10$c4cpUNs1Bj.6EtYitBrLkOkgcEzB94rIAJi7bXuM/vTMb.8f8PvUy'),
  (5,'doctor','Dr. Demo Doctor H05 072','doctor.h05.072@govcare.test','GCD-H05-DOC-072','govcare-demo-network-v1:h05:doctor:072','DEMO-WARD-072','$2a$10$s/UGYwdNwAoSIlR5ncx8A.jTz4kjXi/V6I2DPoA5levlOd8Esonyu'),
  (5,'doctor','Dr. Demo Doctor H05 073','doctor.h05.073@govcare.test','GCD-H05-DOC-073','govcare-demo-network-v1:h05:doctor:073','DEMO-WARD-073','$2a$10$8OqyqIyPqUKUkHN7zIWIBOkL9pnpqf5iEUFmEvQ66CAs6TPyWKCc.'),
  (5,'doctor','Dr. Demo Doctor H05 074','doctor.h05.074@govcare.test','GCD-H05-DOC-074','govcare-demo-network-v1:h05:doctor:074','DEMO-WARD-074','$2a$10$XKLSv0fpRjaBD4u6CGV8MOa/h1Bhn7qjHGX710uPi68tIpKdj/Efi'),
  (5,'doctor','Dr. Demo Doctor H05 075','doctor.h05.075@govcare.test','GCD-H05-DOC-075','govcare-demo-network-v1:h05:doctor:075','DEMO-WARD-075','$2a$10$3EUzh5/DY3ngqdl0c.RVpu7.tb9fOxFcFcPr6uSU4jxaf1GYz44qe'),
  (5,'doctor','Dr. Demo Doctor H05 076','doctor.h05.076@govcare.test','GCD-H05-DOC-076','govcare-demo-network-v1:h05:doctor:076','DEMO-WARD-076','$2a$10$nt7alx9o6yRrZ5stZBrBquDVPjSUnUCJ8K7iWT4ItshtCMMK/AeeK'),
  (5,'doctor','Dr. Demo Doctor H05 077','doctor.h05.077@govcare.test','GCD-H05-DOC-077','govcare-demo-network-v1:h05:doctor:077','DEMO-WARD-077','$2a$10$MNSQ9JBaXwgv9IFIK2IIY.0lMfbhZddREdyPqYEe89wnpXccSGsFi'),
  (5,'doctor','Dr. Demo Doctor H05 078','doctor.h05.078@govcare.test','GCD-H05-DOC-078','govcare-demo-network-v1:h05:doctor:078','DEMO-WARD-078','$2a$10$YEMHp5x/VbBlBloh8f3PQeP8MH.h/p1m3.rv33FK69aCi82XyxD62'),
  (5,'doctor','Dr. Demo Doctor H05 079','doctor.h05.079@govcare.test','GCD-H05-DOC-079','govcare-demo-network-v1:h05:doctor:079','DEMO-WARD-079','$2a$10$kFAQLv7NqLhBw8soAWckXezBnaBHgGad6ckX7w6El1I3w7zwPb4tK'),
  (5,'doctor','Dr. Demo Doctor H05 080','doctor.h05.080@govcare.test','GCD-H05-DOC-080','govcare-demo-network-v1:h05:doctor:080','DEMO-WARD-080','$2a$10$/w.QHsCLbjyzcgc2Q5mdN.FkrcJ.D8mnmN5lP1AaWXHxRkIT9C3Ou'),
  (5,'doctor','Dr. Demo Doctor H05 081','doctor.h05.081@govcare.test','GCD-H05-DOC-081','govcare-demo-network-v1:h05:doctor:081','DEMO-WARD-081','$2a$10$roGPC/LYY8xMnJJgwaQwvuT9PyhZGIgu12I5muYOm3fSA1mzzTOD6'),
  (5,'doctor','Dr. Demo Doctor H05 082','doctor.h05.082@govcare.test','GCD-H05-DOC-082','govcare-demo-network-v1:h05:doctor:082','DEMO-WARD-082','$2a$10$96zUgwnOLnaUxs2/uMuJAe/DJlN5Kf6J3neIQ6ZZyOUZirxJmRzZC'),
  (5,'doctor','Dr. Demo Doctor H05 083','doctor.h05.083@govcare.test','GCD-H05-DOC-083','govcare-demo-network-v1:h05:doctor:083','DEMO-WARD-083','$2a$10$u9Y9jyW/Pth9cJHjhRql2.FB3UIE/s0PedWp4cOAZkojJlAx8wsvi'),
  (5,'doctor','Dr. Demo Doctor H05 084','doctor.h05.084@govcare.test','GCD-H05-DOC-084','govcare-demo-network-v1:h05:doctor:084','DEMO-WARD-084','$2a$10$gcu/EVw4ZPHU9tw/OtkbqOx0Yfd.MWTG7idGNhQ2RbejXNjuObO2W'),
  (5,'doctor','Dr. Demo Doctor H05 085','doctor.h05.085@govcare.test','GCD-H05-DOC-085','govcare-demo-network-v1:h05:doctor:085','DEMO-WARD-085','$2a$10$CQnYpT.IFjKFiJkZmkaFA.4rM73J3iCKFE9rBd7G4j9apcIWKyOSC'),
  (5,'doctor','Dr. Demo Doctor H05 086','doctor.h05.086@govcare.test','GCD-H05-DOC-086','govcare-demo-network-v1:h05:doctor:086','DEMO-WARD-086','$2a$10$U9JSG3fnTH9Ausf4vtFynO8a/AI99jv26inWdSgxTIPPzfpvEwcLq'),
  (5,'doctor','Dr. Demo Doctor H05 087','doctor.h05.087@govcare.test','GCD-H05-DOC-087','govcare-demo-network-v1:h05:doctor:087','DEMO-WARD-087','$2a$10$v1u0rR.0FflqQfh5OkHdJO2FuIa566xR4YXFh1dP7Z07mikctD3pO'),
  (5,'doctor','Dr. Demo Doctor H05 088','doctor.h05.088@govcare.test','GCD-H05-DOC-088','govcare-demo-network-v1:h05:doctor:088','DEMO-WARD-088','$2a$10$Pz/MRsPROWfp8j8HHMSYV.5vlOfR/P7epfR2gr4lwCK6DGBLm09ra'),
  (5,'doctor','Dr. Demo Doctor H05 089','doctor.h05.089@govcare.test','GCD-H05-DOC-089','govcare-demo-network-v1:h05:doctor:089','DEMO-WARD-089','$2a$10$qSG815EafOZOxVUT5Ktg..4ez1QDbgK2xlmIx5hZCxgzCjEVkMx3q'),
  (5,'doctor','Dr. Demo Doctor H05 090','doctor.h05.090@govcare.test','GCD-H05-DOC-090','govcare-demo-network-v1:h05:doctor:090','DEMO-WARD-090','$2a$10$nlPvo22GwbTMWbfCs7aJyO0XxXk7d9nJcSmLJ/5.0qxKbP6D1jx8i'),
  (5,'doctor','Dr. Demo Doctor H05 091','doctor.h05.091@govcare.test','GCD-H05-DOC-091','govcare-demo-network-v1:h05:doctor:091','DEMO-WARD-091','$2a$10$4lN9bXjN2pdlmSvBvPkdx.zgBqmoNO4F4zASSdIxaKm2Y4c7sdgcq'),
  (5,'doctor','Dr. Demo Doctor H05 092','doctor.h05.092@govcare.test','GCD-H05-DOC-092','govcare-demo-network-v1:h05:doctor:092','DEMO-WARD-092','$2a$10$S0Dqmp.AK9iVKU5bdxh6V.VhjjYTbpOteuh2W7yB4OaPY0apsfU.y'),
  (5,'doctor','Dr. Demo Doctor H05 093','doctor.h05.093@govcare.test','GCD-H05-DOC-093','govcare-demo-network-v1:h05:doctor:093','DEMO-WARD-093','$2a$10$s/3Wlu6G.mzpQu/CX3K8xe4RbiZpAJsuflAcNfMal8Y6Kd.2zMiMq'),
  (5,'doctor','Dr. Demo Doctor H05 094','doctor.h05.094@govcare.test','GCD-H05-DOC-094','govcare-demo-network-v1:h05:doctor:094','DEMO-WARD-094','$2a$10$dWVfhmYvS311ntujOdAEROIfJMAUUSYjy1x2Evn44/0QnIcfzOA3G'),
  (5,'doctor','Dr. Demo Doctor H05 095','doctor.h05.095@govcare.test','GCD-H05-DOC-095','govcare-demo-network-v1:h05:doctor:095','DEMO-WARD-095','$2a$10$MbUGRBcpIkZbxMUEGJRequHhFgbRGm5kEmtpwZfEEIm1d/Xn3fGHy'),
  (5,'doctor','Dr. Demo Doctor H05 096','doctor.h05.096@govcare.test','GCD-H05-DOC-096','govcare-demo-network-v1:h05:doctor:096','DEMO-WARD-096','$2a$10$FcBPVcjU7KjP1AjBf8CUReXR61pvByFGkdtKUbBc7LMm4E6Hs/8oK'),
  (5,'doctor','Dr. Demo Doctor H05 097','doctor.h05.097@govcare.test','GCD-H05-DOC-097','govcare-demo-network-v1:h05:doctor:097','DEMO-WARD-097','$2a$10$6SpNvWWTCaDZfjF.lKlrxOuUd7XCGeinJqpbv5FGDk3nbx5CamZaO'),
  (5,'doctor','Dr. Demo Doctor H05 098','doctor.h05.098@govcare.test','GCD-H05-DOC-098','govcare-demo-network-v1:h05:doctor:098','DEMO-WARD-098','$2a$10$2V3.gtUPKkWBcoDX/l6hQ.6CE0Ks0Q3c5X0nyyxZBw6XweFXl9cn2'),
  (5,'doctor','Dr. Demo Doctor H05 099','doctor.h05.099@govcare.test','GCD-H05-DOC-099','govcare-demo-network-v1:h05:doctor:099','DEMO-WARD-099','$2a$10$a5V0ggBlzmVQ3Wi5QOOLEuR2Mr7uuwGB8n3zK71B.Ih.YWuD5ZyVS'),
  (5,'doctor','Dr. Demo Doctor H05 100','doctor.h05.100@govcare.test','GCD-H05-DOC-100','govcare-demo-network-v1:h05:doctor:100','DEMO-WARD-100','$2a$10$LeKgW.v.TQgNzjRfiYlUxu06Xa3biQTO/Ygj81pgFfUjqwKQgxDPW'),
  (5,'hospital_admin','Demo Hospital Admin H05','admin.h05@govcare.test','GCD-H05-ADMIN','govcare-demo-network-v1:h05:hospital_admin','ADMIN','$2a$10$txyEjJVBoYuh4KaW8XeujOTpgRleRiaKNTZVrh1jEI1dAOxWf/GUW'),
  (5,'receptionist','Demo Front Desk Officer H05','reception.h05@govcare.test','GCD-H05-RECEPTION','govcare-demo-network-v1:h05:receptionist','RECEPTION','$2a$10$qvKrux2EQqhfqbkidOPDRestGPYtRj81nbEMLv.FCaCOCj61hZoYO'),
  (5,'nurse','Demo Nurse H05','nurse.h05@govcare.test','GCD-H05-NURSE','govcare-demo-network-v1:h05:nurse','DEMO-WARD-001','$2a$10$6RrXnYlujJeNvomc3TPejuTcLDV3lzFnlsJFInSqnBq.x3V9MsAp.'),
  (5,'ward_manager','Demo Ward Manager H05','wardmanager.h05@govcare.test','GCD-H05-WARDMANAGER','govcare-demo-network-v1:h05:ward_manager','DEMO-WARD-001','$2a$10$UU3hrLux/7GrOPlzQbB/yezu4TNhbmODScwnRV063pdpWBVHlAUMm'),
  (5,'patient','Demo Patient Portal User H05','patient.h05@govcare.test','GCD-H05-PATIENT','govcare-demo-network-v1:h05:patient',null,'$2a$10$DEVjsEPipC3t9aWAPl4S0OtXKhppXMV9iCpCuTJdcf/o6Ehbpl.Om'),
  (5,'guardian','Demo Guardian Portal User H05','guardian.h05@govcare.test','GCD-H05-GUARDIAN','govcare-demo-network-v1:h05:guardian',null,'$2a$10$8hzBWol4ftuFFm1sfkXZqewXp0L06WIUgRQ0yyYEgC1dfNwydStX6'),
  (6,'doctor','Dr. Demo Doctor H06 001','doctor.h06.001@govcare.test','GCD-H06-DOC-001','govcare-demo-network-v1:h06:doctor:001','DEMO-WARD-001','$2a$10$U7Yy618HzBJ9z5QzsfOLIuvsZ/2jiAy104aN4bgwndviZ0CfGT7ZO'),
  (6,'doctor','Dr. Demo Doctor H06 002','doctor.h06.002@govcare.test','GCD-H06-DOC-002','govcare-demo-network-v1:h06:doctor:002','DEMO-WARD-002','$2a$10$qTCZV137FejB26MfEWYWOe6iA3MCXnMkcvPd8QLvtsbRGnKrGB2e6'),
  (6,'doctor','Dr. Demo Doctor H06 003','doctor.h06.003@govcare.test','GCD-H06-DOC-003','govcare-demo-network-v1:h06:doctor:003','DEMO-WARD-003','$2a$10$vT7uBYwmqgzl6h1OWri9GOlHvS/ptOVKy2hp6J6qA3BZExwCXop.W'),
  (6,'doctor','Dr. Demo Doctor H06 004','doctor.h06.004@govcare.test','GCD-H06-DOC-004','govcare-demo-network-v1:h06:doctor:004','DEMO-WARD-004','$2a$10$PgfusEBA.V3N8xS46uoHeuFKZgkX50J5yMDYWAbmrZbCf/HQpAK5i'),
  (6,'doctor','Dr. Demo Doctor H06 005','doctor.h06.005@govcare.test','GCD-H06-DOC-005','govcare-demo-network-v1:h06:doctor:005','DEMO-WARD-005','$2a$10$egDbgALkB2B/1ePdQaUO7.fd6eM4RenhjxGc89JVN22mQIZcGJyWO'),
  (6,'doctor','Dr. Demo Doctor H06 006','doctor.h06.006@govcare.test','GCD-H06-DOC-006','govcare-demo-network-v1:h06:doctor:006','DEMO-WARD-006','$2a$10$EEFQLsQQahDGyETfH1csk.mbEq0dhq4pQpYYQDaTaN4wbB4l2v2VG'),
  (6,'doctor','Dr. Demo Doctor H06 007','doctor.h06.007@govcare.test','GCD-H06-DOC-007','govcare-demo-network-v1:h06:doctor:007','DEMO-WARD-007','$2a$10$Mo1lNvw.I5m204a.Rb3JW.vny8Wy44/yF8nSywocA2w4C3CVJZYLe'),
  (6,'doctor','Dr. Demo Doctor H06 008','doctor.h06.008@govcare.test','GCD-H06-DOC-008','govcare-demo-network-v1:h06:doctor:008','DEMO-WARD-008','$2a$10$MyYlxGlmiFzcdl92bwASue9KTT4DvI4npGJjkmRiaWrKbzvlyDdr2'),
  (6,'doctor','Dr. Demo Doctor H06 009','doctor.h06.009@govcare.test','GCD-H06-DOC-009','govcare-demo-network-v1:h06:doctor:009','DEMO-WARD-009','$2a$10$dVLwEJeqQyOKeWH6oU.0..YEYks5QCBWRjM5DrtpqzBio22A/xmV.'),
  (6,'doctor','Dr. Demo Doctor H06 010','doctor.h06.010@govcare.test','GCD-H06-DOC-010','govcare-demo-network-v1:h06:doctor:010','DEMO-WARD-010','$2a$10$sU2RHFX0zM0GVGgvmK7Iruz4nR8o0S1.4XTSNYEuC3iVNPwJDq49m'),
  (6,'doctor','Dr. Demo Doctor H06 011','doctor.h06.011@govcare.test','GCD-H06-DOC-011','govcare-demo-network-v1:h06:doctor:011','DEMO-WARD-011','$2a$10$7QFX7qcln9iw6JOpQzLB6emsutFO0jFN98yY9Ql73iAJ4.KxBV1i6'),
  (6,'doctor','Dr. Demo Doctor H06 012','doctor.h06.012@govcare.test','GCD-H06-DOC-012','govcare-demo-network-v1:h06:doctor:012','DEMO-WARD-012','$2a$10$NPr0FtWEb99fu8Qpf14lXetQRYu1RlYS80ifIGc2M7JSlGpOl/kJe'),
  (6,'doctor','Dr. Demo Doctor H06 013','doctor.h06.013@govcare.test','GCD-H06-DOC-013','govcare-demo-network-v1:h06:doctor:013','DEMO-WARD-013','$2a$10$XnFsXnqWASD9kTlYgcbRu.oIeCdpnU5dw7.Sv.HOK8v3HPq8Bl1Tm'),
  (6,'doctor','Dr. Demo Doctor H06 014','doctor.h06.014@govcare.test','GCD-H06-DOC-014','govcare-demo-network-v1:h06:doctor:014','DEMO-WARD-014','$2a$10$VXflnESlNBFQQaoqYcngZuC4ABjws3H5.I4YCXT9awlR9BNAsFXyW'),
  (6,'doctor','Dr. Demo Doctor H06 015','doctor.h06.015@govcare.test','GCD-H06-DOC-015','govcare-demo-network-v1:h06:doctor:015','DEMO-WARD-015','$2a$10$jU3hyJefkVhJcO9Z.JCs5eInDims663KtK1wxXEY/uMykWxE55WKG'),
  (6,'doctor','Dr. Demo Doctor H06 016','doctor.h06.016@govcare.test','GCD-H06-DOC-016','govcare-demo-network-v1:h06:doctor:016','DEMO-WARD-016','$2a$10$OKCXldC4VxSeBCEQJaEtr.xRHuHkdIIy.XxjHXX5bcaskDDwL0OSS'),
  (6,'doctor','Dr. Demo Doctor H06 017','doctor.h06.017@govcare.test','GCD-H06-DOC-017','govcare-demo-network-v1:h06:doctor:017','DEMO-WARD-017','$2a$10$3anvkNe447SYsuzmsq.g6u2AnGg0cBOF0N6icSG5ywSalEfxG1V8W'),
  (6,'doctor','Dr. Demo Doctor H06 018','doctor.h06.018@govcare.test','GCD-H06-DOC-018','govcare-demo-network-v1:h06:doctor:018','DEMO-WARD-018','$2a$10$suy4NdXoLO1dRMwtuJOq0eSS7NWfUzoDxEcaqjYRa2OprqBhnwM9S'),
  (6,'doctor','Dr. Demo Doctor H06 019','doctor.h06.019@govcare.test','GCD-H06-DOC-019','govcare-demo-network-v1:h06:doctor:019','DEMO-WARD-019','$2a$10$Ffkhw7Gh3CbM3x7np5lA8.zgN5tMQo4yGDXyJoK6hPKG7TQ.2RRP2'),
  (6,'doctor','Dr. Demo Doctor H06 020','doctor.h06.020@govcare.test','GCD-H06-DOC-020','govcare-demo-network-v1:h06:doctor:020','DEMO-WARD-020','$2a$10$BkRSc3kfuhPoZyk9UZAaNuMWoa5WVKg2XeUUfaj2B3uIpioI1yPta'),
  (6,'doctor','Dr. Demo Doctor H06 021','doctor.h06.021@govcare.test','GCD-H06-DOC-021','govcare-demo-network-v1:h06:doctor:021','DEMO-WARD-021','$2a$10$tWRa.30HJB9orbWkJmYqjeHOQdMVHqcSMTpuBhbLXSv2aCinA181S'),
  (6,'doctor','Dr. Demo Doctor H06 022','doctor.h06.022@govcare.test','GCD-H06-DOC-022','govcare-demo-network-v1:h06:doctor:022','DEMO-WARD-022','$2a$10$VtQll9cEye7Og2pcBnDl7e8Ha8VFZ7lW5t5ClNpB2nChKHNmTuxJK'),
  (6,'doctor','Dr. Demo Doctor H06 023','doctor.h06.023@govcare.test','GCD-H06-DOC-023','govcare-demo-network-v1:h06:doctor:023','DEMO-WARD-023','$2a$10$OTUk9DaMDXgAYyJLAvApae02CiRSxKoiIlx08kr7.0clYELp0UMdS'),
  (6,'doctor','Dr. Demo Doctor H06 024','doctor.h06.024@govcare.test','GCD-H06-DOC-024','govcare-demo-network-v1:h06:doctor:024','DEMO-WARD-024','$2a$10$1OQBuZtLH.NgSM2urtL9tujd8W1ijI5.nElCKXJ4ZVOiUMWTjstaC'),
  (6,'doctor','Dr. Demo Doctor H06 025','doctor.h06.025@govcare.test','GCD-H06-DOC-025','govcare-demo-network-v1:h06:doctor:025','DEMO-WARD-025','$2a$10$QUE1NC481Xs3yzAk8cJlZ.CgTqs1Hv2ASC8UZgqpueHqQaLfMUQjK'),
  (6,'doctor','Dr. Demo Doctor H06 026','doctor.h06.026@govcare.test','GCD-H06-DOC-026','govcare-demo-network-v1:h06:doctor:026','DEMO-WARD-026','$2a$10$dVMY0AiN1sEoygxTWn.qqeukRbDS1iSMnc42FfoWdpevGIfhSa2hK'),
  (6,'doctor','Dr. Demo Doctor H06 027','doctor.h06.027@govcare.test','GCD-H06-DOC-027','govcare-demo-network-v1:h06:doctor:027','DEMO-WARD-027','$2a$10$x15bjzPfcEBrqYzpgN7u0OdtojAHMGg5B1WyaDe.Fk2KsruBTUweq'),
  (6,'doctor','Dr. Demo Doctor H06 028','doctor.h06.028@govcare.test','GCD-H06-DOC-028','govcare-demo-network-v1:h06:doctor:028','DEMO-WARD-028','$2a$10$S72AY22Qa2Y/xs5h14o8u.eQMW0QQ8C.A8lk2iSURycEgpiaCIoeC'),
  (6,'doctor','Dr. Demo Doctor H06 029','doctor.h06.029@govcare.test','GCD-H06-DOC-029','govcare-demo-network-v1:h06:doctor:029','DEMO-WARD-029','$2a$10$aCJUa69iLTvofGG9pWWh5eOE2DjLUT.akklc.hM4F5snamNUlPuAe'),
  (6,'doctor','Dr. Demo Doctor H06 030','doctor.h06.030@govcare.test','GCD-H06-DOC-030','govcare-demo-network-v1:h06:doctor:030','DEMO-WARD-030','$2a$10$NZI3SgabM4UXuwaWsSbzFuavy1H1O.kDC9ApKWHQmhxGVxlw.HQXO'),
  (6,'doctor','Dr. Demo Doctor H06 031','doctor.h06.031@govcare.test','GCD-H06-DOC-031','govcare-demo-network-v1:h06:doctor:031','DEMO-WARD-031','$2a$10$4YNKZk/YqEwBaVvUivMuOeYISb/zVtPBu/I2PMimtFe4OoRp4z75W'),
  (6,'doctor','Dr. Demo Doctor H06 032','doctor.h06.032@govcare.test','GCD-H06-DOC-032','govcare-demo-network-v1:h06:doctor:032','DEMO-WARD-032','$2a$10$9fB/sxhWoOq7Jy2qD8RGcel96DTaWi15bng2Vo38//YtjIRsY7DrS'),
  (6,'doctor','Dr. Demo Doctor H06 033','doctor.h06.033@govcare.test','GCD-H06-DOC-033','govcare-demo-network-v1:h06:doctor:033','DEMO-WARD-033','$2a$10$kOesby1ieGiOc9aRTsX.WOsWZe8IQzyrWypcXLiOczVfU32OkpC3u'),
  (6,'doctor','Dr. Demo Doctor H06 034','doctor.h06.034@govcare.test','GCD-H06-DOC-034','govcare-demo-network-v1:h06:doctor:034','DEMO-WARD-034','$2a$10$qsCqyF1HPjBgEBBUYs8il.IvN20Q.OCFK0tPogZEhapfglFOpLboi'),
  (6,'doctor','Dr. Demo Doctor H06 035','doctor.h06.035@govcare.test','GCD-H06-DOC-035','govcare-demo-network-v1:h06:doctor:035','DEMO-WARD-035','$2a$10$S.bxTGfcRFk5DzV4kOMXne1bvP6CXGPEUa0rBmTTuQim1QlRsYLrq'),
  (6,'doctor','Dr. Demo Doctor H06 036','doctor.h06.036@govcare.test','GCD-H06-DOC-036','govcare-demo-network-v1:h06:doctor:036','DEMO-WARD-036','$2a$10$MSgoDmVOaCZtA0HGBh3zOeQCYyYhP8BwPpws/RotsKx9V62xq.Rk6'),
  (6,'doctor','Dr. Demo Doctor H06 037','doctor.h06.037@govcare.test','GCD-H06-DOC-037','govcare-demo-network-v1:h06:doctor:037','DEMO-WARD-037','$2a$10$WY3gLxJCN8/VfzGCkaCZue7k1ziknDlb8bXsBAM80w96XiEs/O9T2'),
  (6,'doctor','Dr. Demo Doctor H06 038','doctor.h06.038@govcare.test','GCD-H06-DOC-038','govcare-demo-network-v1:h06:doctor:038','DEMO-WARD-038','$2a$10$CuFbNmawKUmMQtHBbB/8deZrGSXeXEVBy3oCsLGM8t/CnEghw9aHi'),
  (6,'doctor','Dr. Demo Doctor H06 039','doctor.h06.039@govcare.test','GCD-H06-DOC-039','govcare-demo-network-v1:h06:doctor:039','DEMO-WARD-039','$2a$10$6gG76G2vYi/2ULHU8U8ghukcutkKwsEfNzEWY4PVT1jz0CUjAWJ2G'),
  (6,'doctor','Dr. Demo Doctor H06 040','doctor.h06.040@govcare.test','GCD-H06-DOC-040','govcare-demo-network-v1:h06:doctor:040','DEMO-WARD-040','$2a$10$d7wGElLgW7xLQTAct.TN3.ksBuHJDxBkS2kwk/kYqoUAZwFjwkdkW'),
  (6,'doctor','Dr. Demo Doctor H06 041','doctor.h06.041@govcare.test','GCD-H06-DOC-041','govcare-demo-network-v1:h06:doctor:041','DEMO-WARD-041','$2a$10$vjClAW8Mz5PLYqQmgbHG3.TPUrXjq1/oY/XpLdUv7lyvLk4gMoYY6'),
  (6,'doctor','Dr. Demo Doctor H06 042','doctor.h06.042@govcare.test','GCD-H06-DOC-042','govcare-demo-network-v1:h06:doctor:042','DEMO-WARD-042','$2a$10$KGNN24ylKv/dShlkAb6vE.NomgrmVPw4Vh/eZ/EdhkEg/8p27YSRm'),
  (6,'doctor','Dr. Demo Doctor H06 043','doctor.h06.043@govcare.test','GCD-H06-DOC-043','govcare-demo-network-v1:h06:doctor:043','DEMO-WARD-043','$2a$10$bWSbVLQGgITCo1MU.EDVpOdKu.HelQ37trgNSEAmnkKNI5vnfvQwG'),
  (6,'doctor','Dr. Demo Doctor H06 044','doctor.h06.044@govcare.test','GCD-H06-DOC-044','govcare-demo-network-v1:h06:doctor:044','DEMO-WARD-044','$2a$10$ilwMVKP/B86jFmW6Dz.3hO0OfpgV22z7W2oqKVPtG6Map8IK2Zqt2'),
  (6,'doctor','Dr. Demo Doctor H06 045','doctor.h06.045@govcare.test','GCD-H06-DOC-045','govcare-demo-network-v1:h06:doctor:045','DEMO-WARD-045','$2a$10$fRZJ261NhxX5A4GlowgsAOP.YnryRPI0rV2tsUu1DL6u4GEsQrGXi'),
  (6,'doctor','Dr. Demo Doctor H06 046','doctor.h06.046@govcare.test','GCD-H06-DOC-046','govcare-demo-network-v1:h06:doctor:046','DEMO-WARD-046','$2a$10$ILbz3QoeLkfn3xS99umV0eYG0ScNYeXtxeeVL8lv/fr/Z4BHEr4xe'),
  (6,'doctor','Dr. Demo Doctor H06 047','doctor.h06.047@govcare.test','GCD-H06-DOC-047','govcare-demo-network-v1:h06:doctor:047','DEMO-WARD-047','$2a$10$fjKWtNkUU6p7.2VwEKh1IuU79dHeGGK05falV7Z.wl26V2/4lHu0u'),
  (6,'doctor','Dr. Demo Doctor H06 048','doctor.h06.048@govcare.test','GCD-H06-DOC-048','govcare-demo-network-v1:h06:doctor:048','DEMO-WARD-048','$2a$10$WL2sHqlcWZ5lbBBxfHIZ6uuCFStAAe9Ww0ipeCqZIkiidpUFssyBy'),
  (6,'doctor','Dr. Demo Doctor H06 049','doctor.h06.049@govcare.test','GCD-H06-DOC-049','govcare-demo-network-v1:h06:doctor:049','DEMO-WARD-049','$2a$10$hZ3S54HLJeKLB7iQq9rfweLC.EfPMlyhYULTIivgq8Z5CsxnFlok2'),
  (6,'doctor','Dr. Demo Doctor H06 050','doctor.h06.050@govcare.test','GCD-H06-DOC-050','govcare-demo-network-v1:h06:doctor:050','DEMO-WARD-050','$2a$10$HwUSMRNFQOrSOIs9Gwi1POzhYz0HQJYGNHTTgOwcQWwnC8RJ1s0rK'),
  (6,'doctor','Dr. Demo Doctor H06 051','doctor.h06.051@govcare.test','GCD-H06-DOC-051','govcare-demo-network-v1:h06:doctor:051','DEMO-WARD-051','$2a$10$djYyOWLieei1OvTr9MbIgezYGt/QFqBoOc79ObgPo3sPB93tP.Sia'),
  (6,'doctor','Dr. Demo Doctor H06 052','doctor.h06.052@govcare.test','GCD-H06-DOC-052','govcare-demo-network-v1:h06:doctor:052','DEMO-WARD-052','$2a$10$BFVlmbt8HU34PKKLMwqhLOlqE5DOLweSDxaWxix52R/3SalKku7p2'),
  (6,'doctor','Dr. Demo Doctor H06 053','doctor.h06.053@govcare.test','GCD-H06-DOC-053','govcare-demo-network-v1:h06:doctor:053','DEMO-WARD-053','$2a$10$VaxQR5tXTv53/f./Nt89ZOVAYf5S0pG.sMWEwjdTnvQN80PmcHbTi'),
  (6,'doctor','Dr. Demo Doctor H06 054','doctor.h06.054@govcare.test','GCD-H06-DOC-054','govcare-demo-network-v1:h06:doctor:054','DEMO-WARD-054','$2a$10$OnLJTopFyVIQ0xJVkNhbSudOafSZSbr7mstw4MuEyVpSRsp3XfIGm'),
  (6,'doctor','Dr. Demo Doctor H06 055','doctor.h06.055@govcare.test','GCD-H06-DOC-055','govcare-demo-network-v1:h06:doctor:055','DEMO-WARD-055','$2a$10$1HR/t9b95sc.jsFeo9R0xemSvCpwa4X1U/6K0IS8r6GUq04rPX.o.'),
  (6,'doctor','Dr. Demo Doctor H06 056','doctor.h06.056@govcare.test','GCD-H06-DOC-056','govcare-demo-network-v1:h06:doctor:056','DEMO-WARD-056','$2a$10$asYgnYjdrb34cB4bMzRjt.ygH0hd64pWlKnhMjdIx/Gst8gX1njNm'),
  (6,'doctor','Dr. Demo Doctor H06 057','doctor.h06.057@govcare.test','GCD-H06-DOC-057','govcare-demo-network-v1:h06:doctor:057','DEMO-WARD-057','$2a$10$0ess6QSBsVu4tldLBmpPR./5HoX/4yH2G6WE4Gi.FS/g1gbBvqJXW'),
  (6,'doctor','Dr. Demo Doctor H06 058','doctor.h06.058@govcare.test','GCD-H06-DOC-058','govcare-demo-network-v1:h06:doctor:058','DEMO-WARD-058','$2a$10$oDwU0WUdkV6iwwzw9keNrec2J5yVISMG8Q5zL5ZUixPUKEPFZNIC2'),
  (6,'doctor','Dr. Demo Doctor H06 059','doctor.h06.059@govcare.test','GCD-H06-DOC-059','govcare-demo-network-v1:h06:doctor:059','DEMO-WARD-059','$2a$10$f.q2uem3WKgKOw4bvprG7eZBQyOtOXacTXrqz9vL2q3.zmULW2Eam'),
  (6,'doctor','Dr. Demo Doctor H06 060','doctor.h06.060@govcare.test','GCD-H06-DOC-060','govcare-demo-network-v1:h06:doctor:060','DEMO-WARD-060','$2a$10$J1uMIPF64hADgK/y1rzKFeZRyFONy2eKDgwMLDh679i9pZhrzjEMC'),
  (6,'doctor','Dr. Demo Doctor H06 061','doctor.h06.061@govcare.test','GCD-H06-DOC-061','govcare-demo-network-v1:h06:doctor:061','DEMO-WARD-061','$2a$10$2hvYUY30Vy/QLD6lC8OKDeUJRGyVni3jpPLk1N/NmqBjQvqOHhOKO'),
  (6,'doctor','Dr. Demo Doctor H06 062','doctor.h06.062@govcare.test','GCD-H06-DOC-062','govcare-demo-network-v1:h06:doctor:062','DEMO-WARD-062','$2a$10$ZOuQ1yNU3.6yk/uo8YjnXewu5M4QY7hZ6TkY2v6fcNCQqtJIlvnum'),
  (6,'doctor','Dr. Demo Doctor H06 063','doctor.h06.063@govcare.test','GCD-H06-DOC-063','govcare-demo-network-v1:h06:doctor:063','DEMO-WARD-063','$2a$10$84Pq.1IW5Er8WjX.p8gwvOeePmXaLQUDmWIYtyYqT7WEI1sOpsxii'),
  (6,'doctor','Dr. Demo Doctor H06 064','doctor.h06.064@govcare.test','GCD-H06-DOC-064','govcare-demo-network-v1:h06:doctor:064','DEMO-WARD-064','$2a$10$UlRvSA2.Cry3aGAJoEbqYeknTCN9zt6ig7OTMUkK2Zuh91xvYWNZK'),
  (6,'doctor','Dr. Demo Doctor H06 065','doctor.h06.065@govcare.test','GCD-H06-DOC-065','govcare-demo-network-v1:h06:doctor:065','DEMO-WARD-065','$2a$10$TnQuGeniX2BdVKh8aGOe2..ix.DZr8OIattPPmRyWNK2n6.oAid.i'),
  (6,'doctor','Dr. Demo Doctor H06 066','doctor.h06.066@govcare.test','GCD-H06-DOC-066','govcare-demo-network-v1:h06:doctor:066','DEMO-WARD-066','$2a$10$Sm816b5ZpWqqHdgOYIXFz.jl.IU2dn7MVjd.d25jl54kLjpzQeC4q'),
  (6,'doctor','Dr. Demo Doctor H06 067','doctor.h06.067@govcare.test','GCD-H06-DOC-067','govcare-demo-network-v1:h06:doctor:067','DEMO-WARD-067','$2a$10$hwc9gR60zHaqb8a81nlzb.yxAyJ9tt3GUyaHIF6d2bfkzO77KYFhW'),
  (6,'doctor','Dr. Demo Doctor H06 068','doctor.h06.068@govcare.test','GCD-H06-DOC-068','govcare-demo-network-v1:h06:doctor:068','DEMO-WARD-068','$2a$10$wtWqtn6FePx1TzWNCnQB8ecFZjWMVnj6xOQ7PTDOWRkWtjuT/jXAG'),
  (6,'doctor','Dr. Demo Doctor H06 069','doctor.h06.069@govcare.test','GCD-H06-DOC-069','govcare-demo-network-v1:h06:doctor:069','DEMO-WARD-069','$2a$10$av0KO7hYNRLOlphTTpwpUu1fBWadR8cu6/PYQEZqgpBTnGdUKZ1mm'),
  (6,'doctor','Dr. Demo Doctor H06 070','doctor.h06.070@govcare.test','GCD-H06-DOC-070','govcare-demo-network-v1:h06:doctor:070','DEMO-WARD-070','$2a$10$Og/FX.4TpMkjV0LBb4Haju8JwyJAGnJXf3uFS1oevV/B/lVQEmGXy'),
  (6,'doctor','Dr. Demo Doctor H06 071','doctor.h06.071@govcare.test','GCD-H06-DOC-071','govcare-demo-network-v1:h06:doctor:071','DEMO-WARD-071','$2a$10$TZ2MQNyBSLpavle16vtD9.HSieKITYezaJbaW5YLWX/phYZZ2A2Iq'),
  (6,'doctor','Dr. Demo Doctor H06 072','doctor.h06.072@govcare.test','GCD-H06-DOC-072','govcare-demo-network-v1:h06:doctor:072','DEMO-WARD-072','$2a$10$timM.uPBqneknqsShTFI.uaUT1hoKdUa5CWzr0Gnj1Kmt3UXDijWO'),
  (6,'doctor','Dr. Demo Doctor H06 073','doctor.h06.073@govcare.test','GCD-H06-DOC-073','govcare-demo-network-v1:h06:doctor:073','DEMO-WARD-073','$2a$10$9.wS5/Tk4Jp0qpCOO45DIeox6NN..oGnTPof.7ieHZ/rwg61ezFlC'),
  (6,'doctor','Dr. Demo Doctor H06 074','doctor.h06.074@govcare.test','GCD-H06-DOC-074','govcare-demo-network-v1:h06:doctor:074','DEMO-WARD-074','$2a$10$eiiM/ytOZoDnokF8riiz6uinTnxiZ3CkyVfxTdxVkhHa/OnBBfVym'),
  (6,'doctor','Dr. Demo Doctor H06 075','doctor.h06.075@govcare.test','GCD-H06-DOC-075','govcare-demo-network-v1:h06:doctor:075','DEMO-WARD-075','$2a$10$JpkJk00.odJvzND52mKg1eoedqEvJsr0Z7I51kt7WO5X7/O7crneC'),
  (6,'doctor','Dr. Demo Doctor H06 076','doctor.h06.076@govcare.test','GCD-H06-DOC-076','govcare-demo-network-v1:h06:doctor:076','DEMO-WARD-076','$2a$10$dTLgT9vEqMSrPNywwd./weHWBpLawxOD3L2txZ6VXvU7AR6a3Dnpi'),
  (6,'doctor','Dr. Demo Doctor H06 077','doctor.h06.077@govcare.test','GCD-H06-DOC-077','govcare-demo-network-v1:h06:doctor:077','DEMO-WARD-077','$2a$10$dmAhTPshFRP6rlZBw8dx2eYdP3MHyfbnVwfMh5wUl09aD4uRb4Fx.'),
  (6,'doctor','Dr. Demo Doctor H06 078','doctor.h06.078@govcare.test','GCD-H06-DOC-078','govcare-demo-network-v1:h06:doctor:078','DEMO-WARD-078','$2a$10$QI6QCTIylQdB3NFCXJyz6u9rrcFFhXDeFjK4glPpqEVC2be1aEvVq'),
  (6,'doctor','Dr. Demo Doctor H06 079','doctor.h06.079@govcare.test','GCD-H06-DOC-079','govcare-demo-network-v1:h06:doctor:079','DEMO-WARD-079','$2a$10$9cWiHzOsccRqjD.TVUhBlOLmWzPaWDtOq0JV7BzokeqGx4aFBt6N6'),
  (6,'doctor','Dr. Demo Doctor H06 080','doctor.h06.080@govcare.test','GCD-H06-DOC-080','govcare-demo-network-v1:h06:doctor:080','DEMO-WARD-080','$2a$10$8yU3.qyjpfVWHd22lQbDLe6wNhrKhls3oscyf4vXK0rzuBskhDR6.'),
  (6,'doctor','Dr. Demo Doctor H06 081','doctor.h06.081@govcare.test','GCD-H06-DOC-081','govcare-demo-network-v1:h06:doctor:081','DEMO-WARD-081','$2a$10$k5qivIALHFqRq7WXCLBAYOdi2MZc92JukBvlj6cLTsQ4xs5YA0uYq'),
  (6,'doctor','Dr. Demo Doctor H06 082','doctor.h06.082@govcare.test','GCD-H06-DOC-082','govcare-demo-network-v1:h06:doctor:082','DEMO-WARD-082','$2a$10$1WiPmD28NMLWkHDWvyi22Oqd6EbXz1kr3AYrZcOD3baensElSG4.C'),
  (6,'doctor','Dr. Demo Doctor H06 083','doctor.h06.083@govcare.test','GCD-H06-DOC-083','govcare-demo-network-v1:h06:doctor:083','DEMO-WARD-083','$2a$10$zWdCGspwlfkgPAJnFX0xs.4LAItxNIP8cudMDgLSBvlZiwokTQhce'),
  (6,'doctor','Dr. Demo Doctor H06 084','doctor.h06.084@govcare.test','GCD-H06-DOC-084','govcare-demo-network-v1:h06:doctor:084','DEMO-WARD-084','$2a$10$IBnFZSvsFIw4g3O.K7P21.2NPSxGt3Hpq5OW.D9TbYA4Ek46gcg2G'),
  (6,'doctor','Dr. Demo Doctor H06 085','doctor.h06.085@govcare.test','GCD-H06-DOC-085','govcare-demo-network-v1:h06:doctor:085','DEMO-WARD-085','$2a$10$MTDVr1bvwVa2H4Tiv71FN.bGCnyQJ4BuM0yigcA1ZJXrgf1KhX5Re'),
  (6,'doctor','Dr. Demo Doctor H06 086','doctor.h06.086@govcare.test','GCD-H06-DOC-086','govcare-demo-network-v1:h06:doctor:086','DEMO-WARD-086','$2a$10$SIfFFmRyR0OsPrKv53pnCOVSOspDMhQRh6MIREZzpzTyDaH1hrbaW'),
  (6,'doctor','Dr. Demo Doctor H06 087','doctor.h06.087@govcare.test','GCD-H06-DOC-087','govcare-demo-network-v1:h06:doctor:087','DEMO-WARD-087','$2a$10$404ThkxGqKWMcf9neiocGOkQkGA8kzpGUoJ4YkiFo/5AjN.5FTWZC'),
  (6,'doctor','Dr. Demo Doctor H06 088','doctor.h06.088@govcare.test','GCD-H06-DOC-088','govcare-demo-network-v1:h06:doctor:088','DEMO-WARD-088','$2a$10$bAjwN2XEP8xaG1orWuVw3etyYU/R9a9Uza1T8WhhJy/lklJ6x8iTO'),
  (6,'doctor','Dr. Demo Doctor H06 089','doctor.h06.089@govcare.test','GCD-H06-DOC-089','govcare-demo-network-v1:h06:doctor:089','DEMO-WARD-089','$2a$10$i6DnSpzrD1Bq1q6paqhPAuFekBB3zg/8HOTo4rsUMZgHlQheN9E0a'),
  (6,'doctor','Dr. Demo Doctor H06 090','doctor.h06.090@govcare.test','GCD-H06-DOC-090','govcare-demo-network-v1:h06:doctor:090','DEMO-WARD-090','$2a$10$//UmLme64bEcneAKc5InJeXbyPCieSvqaQJ4Xz50aqD1T2t82Zuyu'),
  (6,'doctor','Dr. Demo Doctor H06 091','doctor.h06.091@govcare.test','GCD-H06-DOC-091','govcare-demo-network-v1:h06:doctor:091','DEMO-WARD-091','$2a$10$qbB3qtLWtX3LS8ykLd07CeCwYoz5o.Hl9/ijBgsc0d3LjHFDS/PtK'),
  (6,'doctor','Dr. Demo Doctor H06 092','doctor.h06.092@govcare.test','GCD-H06-DOC-092','govcare-demo-network-v1:h06:doctor:092','DEMO-WARD-092','$2a$10$tdK01T2A/6Rq2qusn3lfo.mfO60OlvSMGLhpmE/5jdPGQ5PsGmpfq'),
  (6,'doctor','Dr. Demo Doctor H06 093','doctor.h06.093@govcare.test','GCD-H06-DOC-093','govcare-demo-network-v1:h06:doctor:093','DEMO-WARD-093','$2a$10$bJU56AsAJ1LGAJicoTzMj.gRNX/ZPxQdKMDifD2wY7fCDIVAc4hOa'),
  (6,'doctor','Dr. Demo Doctor H06 094','doctor.h06.094@govcare.test','GCD-H06-DOC-094','govcare-demo-network-v1:h06:doctor:094','DEMO-WARD-094','$2a$10$34HJzDGOARzKRbVHpdo/c.nPd/FIWn3oO7wuV1l6f5LcMWoeTiani'),
  (6,'doctor','Dr. Demo Doctor H06 095','doctor.h06.095@govcare.test','GCD-H06-DOC-095','govcare-demo-network-v1:h06:doctor:095','DEMO-WARD-095','$2a$10$bN.BD1If5eGhIywMhWewv.VIvCbGqYv13AW.Xlp5yal1jmTgOpkm2'),
  (6,'doctor','Dr. Demo Doctor H06 096','doctor.h06.096@govcare.test','GCD-H06-DOC-096','govcare-demo-network-v1:h06:doctor:096','DEMO-WARD-096','$2a$10$Qy9kZ5/XCwjBcZ4cpPO2v.6EtrxBUwAtM02eQTIl71P0p5tvpERdy'),
  (6,'doctor','Dr. Demo Doctor H06 097','doctor.h06.097@govcare.test','GCD-H06-DOC-097','govcare-demo-network-v1:h06:doctor:097','DEMO-WARD-097','$2a$10$rhBGK9FUoqpRX43sRNmR.uy2BRlJ8r0mhsmvLmKn.ie1p2mcNCFXa'),
  (6,'doctor','Dr. Demo Doctor H06 098','doctor.h06.098@govcare.test','GCD-H06-DOC-098','govcare-demo-network-v1:h06:doctor:098','DEMO-WARD-098','$2a$10$J9ONuYF28UtU/ZRSPak.A.2zmhjSRjx8sJH2r33fyjQqd6/tYTqou'),
  (6,'doctor','Dr. Demo Doctor H06 099','doctor.h06.099@govcare.test','GCD-H06-DOC-099','govcare-demo-network-v1:h06:doctor:099','DEMO-WARD-099','$2a$10$jIQr9fftkFc1/tFuj.mEPuY0ZmZl7yVJdO8.8iGHB9oDTojYz5CC.'),
  (6,'doctor','Dr. Demo Doctor H06 100','doctor.h06.100@govcare.test','GCD-H06-DOC-100','govcare-demo-network-v1:h06:doctor:100','DEMO-WARD-100','$2a$10$3J03ulHNdfFr4JgBn8c72uYyvwN5cE5KPGJykzQ5f/id8rEucWsCy'),
  (6,'hospital_admin','Demo Hospital Admin H06','admin.h06@govcare.test','GCD-H06-ADMIN','govcare-demo-network-v1:h06:hospital_admin','ADMIN','$2a$10$1Jy7a5dDE3Z8ui6PVzdH6ewvFQxaH8WBjZikOCEaPvF.rW/I7gb7u'),
  (6,'receptionist','Demo Front Desk Officer H06','reception.h06@govcare.test','GCD-H06-RECEPTION','govcare-demo-network-v1:h06:receptionist','RECEPTION','$2a$10$NYDrUqPjpHG9tpeMyti1Oe.ikLtXvS4b23/tVnSYpWStcmw4KC8TO'),
  (6,'nurse','Demo Nurse H06','nurse.h06@govcare.test','GCD-H06-NURSE','govcare-demo-network-v1:h06:nurse','DEMO-WARD-001','$2a$10$sPbIOPPE38MYNzuaSIromefDVgq6PoyzRB8SJeIuBnjRMb5QHD3LO'),
  (6,'ward_manager','Demo Ward Manager H06','wardmanager.h06@govcare.test','GCD-H06-WARDMANAGER','govcare-demo-network-v1:h06:ward_manager','DEMO-WARD-001','$2a$10$qcgrQvLjG0p/501WTYx5UeQuGjmGpwtsAf/q.276KSEDQIADFYCum'),
  (6,'patient','Demo Patient Portal User H06','patient.h06@govcare.test','GCD-H06-PATIENT','govcare-demo-network-v1:h06:patient',null,'$2a$10$KdqM6bRrpvdfprb9dZ.UfuNLVuIRxx0yqFERHDlF5xnpZz9c4x3zu'),
  (6,'guardian','Demo Guardian Portal User H06','guardian.h06@govcare.test','GCD-H06-GUARDIAN','govcare-demo-network-v1:h06:guardian',null,'$2a$10$79LQkqC7BLoTgV1Ftoit3uhjzCKNLGdZd3MGR/QVitSUM.VL/qjyC'),
  (7,'doctor','Dr. Demo Doctor H07 001','doctor.h07.001@govcare.test','GCD-H07-DOC-001','govcare-demo-network-v1:h07:doctor:001','DEMO-WARD-001','$2a$10$Gf.GI19GpCIkmlRR9174l.AS4dEoRMGrklTuw70UZGNuKjcJHZqqS'),
  (7,'doctor','Dr. Demo Doctor H07 002','doctor.h07.002@govcare.test','GCD-H07-DOC-002','govcare-demo-network-v1:h07:doctor:002','DEMO-WARD-002','$2a$10$8sYNTdsiNpIAyZVPXXBTqeloNlujKk/jaXvEzUXb1NsG2JkNGpDZy'),
  (7,'doctor','Dr. Demo Doctor H07 003','doctor.h07.003@govcare.test','GCD-H07-DOC-003','govcare-demo-network-v1:h07:doctor:003','DEMO-WARD-003','$2a$10$lZCVlvm.qj9TWQDoDQNMBOk.i7pL241ot6rz02q0vcs144UcI77HK'),
  (7,'doctor','Dr. Demo Doctor H07 004','doctor.h07.004@govcare.test','GCD-H07-DOC-004','govcare-demo-network-v1:h07:doctor:004','DEMO-WARD-004','$2a$10$YufrXKFP/bZq3rsygKTetufW2xFYSFvnNRnO5MY/IAm5St2o.59cq'),
  (7,'doctor','Dr. Demo Doctor H07 005','doctor.h07.005@govcare.test','GCD-H07-DOC-005','govcare-demo-network-v1:h07:doctor:005','DEMO-WARD-005','$2a$10$M9r2oIsR9pWfPYTCGvAzxuOBdtYfUA4TnkzeLqnuPZmdGPGdtFrGe'),
  (7,'doctor','Dr. Demo Doctor H07 006','doctor.h07.006@govcare.test','GCD-H07-DOC-006','govcare-demo-network-v1:h07:doctor:006','DEMO-WARD-006','$2a$10$2XhH5eWVvw8d/VnTo4GGjudgZ5ZLiiVzi6ZIbg3CgvoxNPD40ZcLO'),
  (7,'doctor','Dr. Demo Doctor H07 007','doctor.h07.007@govcare.test','GCD-H07-DOC-007','govcare-demo-network-v1:h07:doctor:007','DEMO-WARD-007','$2a$10$sOLFWJHRAwAF2kSG4/EcZOLwTRR0fmq0.qeZDV40Nyt6slUCMuLde'),
  (7,'doctor','Dr. Demo Doctor H07 008','doctor.h07.008@govcare.test','GCD-H07-DOC-008','govcare-demo-network-v1:h07:doctor:008','DEMO-WARD-008','$2a$10$WLESV.Ud2WS8GZQjZc.ZoO2sGAnz9BNgsdvGhnmzf7xjB.nMrvVq2'),
  (7,'doctor','Dr. Demo Doctor H07 009','doctor.h07.009@govcare.test','GCD-H07-DOC-009','govcare-demo-network-v1:h07:doctor:009','DEMO-WARD-009','$2a$10$UFOIw3nllU7hjeiXPBJj4.aC1Z0PC1r77YvCXyvt.SoWaWvsXFdHq'),
  (7,'doctor','Dr. Demo Doctor H07 010','doctor.h07.010@govcare.test','GCD-H07-DOC-010','govcare-demo-network-v1:h07:doctor:010','DEMO-WARD-010','$2a$10$PsNEL.m2J5TfYWTZnPNCiOAhaPw.gVJu2jLV9eOBNMEHlSwI5kqMm'),
  (7,'doctor','Dr. Demo Doctor H07 011','doctor.h07.011@govcare.test','GCD-H07-DOC-011','govcare-demo-network-v1:h07:doctor:011','DEMO-WARD-011','$2a$10$mgjvtGqkhkrIYfyaCFOvteHVYL8tvcvgcNgTymVDEG5pTHfuMNjyq'),
  (7,'doctor','Dr. Demo Doctor H07 012','doctor.h07.012@govcare.test','GCD-H07-DOC-012','govcare-demo-network-v1:h07:doctor:012','DEMO-WARD-012','$2a$10$68OQvw7JARp6QEXUd2FqRePZtI531c7uGvb4esG1eYg/Dcsqk0K72'),
  (7,'doctor','Dr. Demo Doctor H07 013','doctor.h07.013@govcare.test','GCD-H07-DOC-013','govcare-demo-network-v1:h07:doctor:013','DEMO-WARD-013','$2a$10$A5w73cO628ejM97G1.ApneFZKb4DHfKE3pBdsI1B7RFC3PIBJjKcm'),
  (7,'doctor','Dr. Demo Doctor H07 014','doctor.h07.014@govcare.test','GCD-H07-DOC-014','govcare-demo-network-v1:h07:doctor:014','DEMO-WARD-014','$2a$10$OGxc1HR8JGnRfueD1AODt.DnftD7lKMjOJlDsuTJyUDixOd1yaPAC'),
  (7,'doctor','Dr. Demo Doctor H07 015','doctor.h07.015@govcare.test','GCD-H07-DOC-015','govcare-demo-network-v1:h07:doctor:015','DEMO-WARD-015','$2a$10$dYRMV1OCIqfZABr.rjnQJeTqdVvwfy7MfbFscjDu6XXghLKOU4iZO'),
  (7,'doctor','Dr. Demo Doctor H07 016','doctor.h07.016@govcare.test','GCD-H07-DOC-016','govcare-demo-network-v1:h07:doctor:016','DEMO-WARD-016','$2a$10$s1vMBVC8r8CmhDJImimF3O9b//EO56Yz1kGaFY/5.cXF5C3OkAWTK'),
  (7,'doctor','Dr. Demo Doctor H07 017','doctor.h07.017@govcare.test','GCD-H07-DOC-017','govcare-demo-network-v1:h07:doctor:017','DEMO-WARD-017','$2a$10$NYpJ8Ux1PGfsqEJfLqYoee9Y1dSE97jYem0CKHB2oPqQ2KomOifmq'),
  (7,'doctor','Dr. Demo Doctor H07 018','doctor.h07.018@govcare.test','GCD-H07-DOC-018','govcare-demo-network-v1:h07:doctor:018','DEMO-WARD-018','$2a$10$BbG46CO2G2IBAREvYnAJ1uPA217K/VflHYyjtSj9LuEGv7Tvj0oIO'),
  (7,'doctor','Dr. Demo Doctor H07 019','doctor.h07.019@govcare.test','GCD-H07-DOC-019','govcare-demo-network-v1:h07:doctor:019','DEMO-WARD-019','$2a$10$UHmvWDFuMkRg4UUoawalW.hQcjRTi.c.XHtValA8gNzloPuvDwitK'),
  (7,'doctor','Dr. Demo Doctor H07 020','doctor.h07.020@govcare.test','GCD-H07-DOC-020','govcare-demo-network-v1:h07:doctor:020','DEMO-WARD-020','$2a$10$FvfMMTVP.FUEAfL7.OI.6uHuull./kXJZ1UFeBwQILZllslAeSpPi'),
  (7,'doctor','Dr. Demo Doctor H07 021','doctor.h07.021@govcare.test','GCD-H07-DOC-021','govcare-demo-network-v1:h07:doctor:021','DEMO-WARD-021','$2a$10$NTwRtDmoCtj3JMVFPK5xQOsr7hSjioZf.TMu5mqsA1AvMvSTaMKr6'),
  (7,'doctor','Dr. Demo Doctor H07 022','doctor.h07.022@govcare.test','GCD-H07-DOC-022','govcare-demo-network-v1:h07:doctor:022','DEMO-WARD-022','$2a$10$ZVk.yx/oAdB9Zp3VKDJ/7u.KpGebHcHGRbSB/3WyiZBehJrnAOXtK'),
  (7,'doctor','Dr. Demo Doctor H07 023','doctor.h07.023@govcare.test','GCD-H07-DOC-023','govcare-demo-network-v1:h07:doctor:023','DEMO-WARD-023','$2a$10$4LK7kcGfk8uMIAJX54TdN.bB6Be6b/wldwJwi4CtK.Djv6QYoKMzS'),
  (7,'doctor','Dr. Demo Doctor H07 024','doctor.h07.024@govcare.test','GCD-H07-DOC-024','govcare-demo-network-v1:h07:doctor:024','DEMO-WARD-024','$2a$10$E6pnAqje5zekWGhd.b1fwuKyI4RVpHk/QieVlwpFmbED7O79eoMx6'),
  (7,'doctor','Dr. Demo Doctor H07 025','doctor.h07.025@govcare.test','GCD-H07-DOC-025','govcare-demo-network-v1:h07:doctor:025','DEMO-WARD-025','$2a$10$Eq12i3RJ.X94gvbs8b0M/eN9Zsi6/Kkdg29BN0JiStak4SH2A0Yi6'),
  (7,'doctor','Dr. Demo Doctor H07 026','doctor.h07.026@govcare.test','GCD-H07-DOC-026','govcare-demo-network-v1:h07:doctor:026','DEMO-WARD-026','$2a$10$Ho..DIIlqNf1p1n9ALGfXuo/Oc0MOZun1iaCccgvsY9X6UyXehTd2'),
  (7,'doctor','Dr. Demo Doctor H07 027','doctor.h07.027@govcare.test','GCD-H07-DOC-027','govcare-demo-network-v1:h07:doctor:027','DEMO-WARD-027','$2a$10$l0nqiYpA6AsyC910Th68geJsPJqIjdYMw2gj6k8f3yKtS4xU99.Gm'),
  (7,'doctor','Dr. Demo Doctor H07 028','doctor.h07.028@govcare.test','GCD-H07-DOC-028','govcare-demo-network-v1:h07:doctor:028','DEMO-WARD-028','$2a$10$bEITUotzBrilsD5vBtv7UOJH7LN84GoyCLO1bibhe7yXaQ0tNEhn6'),
  (7,'doctor','Dr. Demo Doctor H07 029','doctor.h07.029@govcare.test','GCD-H07-DOC-029','govcare-demo-network-v1:h07:doctor:029','DEMO-WARD-029','$2a$10$KTX2kkIa1tX1gOVEQN/fcuy6yPgpJLnSeYYvl794hUHdwGLdGHD2a'),
  (7,'doctor','Dr. Demo Doctor H07 030','doctor.h07.030@govcare.test','GCD-H07-DOC-030','govcare-demo-network-v1:h07:doctor:030','DEMO-WARD-030','$2a$10$t3Mri4X595N8LxevxmlRwO8LJr7bwFjg1o6k3aDfOnbrROK78MsFm'),
  (7,'doctor','Dr. Demo Doctor H07 031','doctor.h07.031@govcare.test','GCD-H07-DOC-031','govcare-demo-network-v1:h07:doctor:031','DEMO-WARD-031','$2a$10$87aA2ZtvLiLmSg6B8oQUeO3ZKySZY3GQhK.7xfiBDzoMTlmb48kgy'),
  (7,'doctor','Dr. Demo Doctor H07 032','doctor.h07.032@govcare.test','GCD-H07-DOC-032','govcare-demo-network-v1:h07:doctor:032','DEMO-WARD-032','$2a$10$8ataOHyHxth1Wa6i6zEWF.IlPNvKc8ieiWq2eJEPz3M/Yq.88zg4y'),
  (7,'doctor','Dr. Demo Doctor H07 033','doctor.h07.033@govcare.test','GCD-H07-DOC-033','govcare-demo-network-v1:h07:doctor:033','DEMO-WARD-033','$2a$10$2UcUm1UgKjj8qDHxPcKI4.dadoAFMToeFsFqubZWJUY6xurHpJaIC'),
  (7,'doctor','Dr. Demo Doctor H07 034','doctor.h07.034@govcare.test','GCD-H07-DOC-034','govcare-demo-network-v1:h07:doctor:034','DEMO-WARD-034','$2a$10$lwJFFaTm/ja93XsS8cW/9uJRcKfwCVDxZn.GyK2HHOEwbFkRIITMG'),
  (7,'doctor','Dr. Demo Doctor H07 035','doctor.h07.035@govcare.test','GCD-H07-DOC-035','govcare-demo-network-v1:h07:doctor:035','DEMO-WARD-035','$2a$10$qxR/xeap3BNBXEAmNNnXuexdgkh1FZZlQyRlMaa.LPZJteBdUXV3W'),
  (7,'doctor','Dr. Demo Doctor H07 036','doctor.h07.036@govcare.test','GCD-H07-DOC-036','govcare-demo-network-v1:h07:doctor:036','DEMO-WARD-036','$2a$10$uIHvMnotdVR65ynboJtm2uHChaM0RTQHixLKITFeB0Fy5c/V5NqWi'),
  (7,'doctor','Dr. Demo Doctor H07 037','doctor.h07.037@govcare.test','GCD-H07-DOC-037','govcare-demo-network-v1:h07:doctor:037','DEMO-WARD-037','$2a$10$gaTN8lp7t9HwWdOsswSUDOOkVrGIe89byZlw7yIhDUijp5QE2mhBC'),
  (7,'doctor','Dr. Demo Doctor H07 038','doctor.h07.038@govcare.test','GCD-H07-DOC-038','govcare-demo-network-v1:h07:doctor:038','DEMO-WARD-038','$2a$10$qm1klXglMlK/JrpAI3oj8eDqb5P/VXC8hhvNyKt2ZbZLc424XkHT.'),
  (7,'doctor','Dr. Demo Doctor H07 039','doctor.h07.039@govcare.test','GCD-H07-DOC-039','govcare-demo-network-v1:h07:doctor:039','DEMO-WARD-039','$2a$10$zTSdJgDzTT6qh8pJWWD42.zno6zytGBh0REwmKrVZOlxhoSBpuiiC'),
  (7,'doctor','Dr. Demo Doctor H07 040','doctor.h07.040@govcare.test','GCD-H07-DOC-040','govcare-demo-network-v1:h07:doctor:040','DEMO-WARD-040','$2a$10$dDMW4xyFw3reL/d6iIK7Eu0NUTaTeoKeoYAZYOjTncjnmKK1KalG6'),
  (7,'doctor','Dr. Demo Doctor H07 041','doctor.h07.041@govcare.test','GCD-H07-DOC-041','govcare-demo-network-v1:h07:doctor:041','DEMO-WARD-041','$2a$10$NOCFxbPDa3NtZlgNzBf8P.zjWlcdCa.IPOMVH.QpgVg7KonX57nju'),
  (7,'doctor','Dr. Demo Doctor H07 042','doctor.h07.042@govcare.test','GCD-H07-DOC-042','govcare-demo-network-v1:h07:doctor:042','DEMO-WARD-042','$2a$10$gL6pV5EqGI9u3Sm5rVLtuuO47QL0j89s5DF1J.nZNae8qAP63e126'),
  (7,'doctor','Dr. Demo Doctor H07 043','doctor.h07.043@govcare.test','GCD-H07-DOC-043','govcare-demo-network-v1:h07:doctor:043','DEMO-WARD-043','$2a$10$XynUHsM.nuIy3dk/aiYTteOSuMpliVvTxA7ip4VVPFVUf/nUXIlsa'),
  (7,'doctor','Dr. Demo Doctor H07 044','doctor.h07.044@govcare.test','GCD-H07-DOC-044','govcare-demo-network-v1:h07:doctor:044','DEMO-WARD-044','$2a$10$asIuObwtWCypIXsGVcc.UOQRUHbHZ5w3cx4LP8XO0lNNdeTFrrm02'),
  (7,'doctor','Dr. Demo Doctor H07 045','doctor.h07.045@govcare.test','GCD-H07-DOC-045','govcare-demo-network-v1:h07:doctor:045','DEMO-WARD-045','$2a$10$7wZN0DLjLsOmwBA8jqfysO/YXB6CisgQpR7jJA1LOZqim.ENuAsES'),
  (7,'doctor','Dr. Demo Doctor H07 046','doctor.h07.046@govcare.test','GCD-H07-DOC-046','govcare-demo-network-v1:h07:doctor:046','DEMO-WARD-046','$2a$10$tpRxYuDpBSa5gHwytWDr5ecbKDmgpqbNigX0ilXdNYs2tSamvPgPe'),
  (7,'doctor','Dr. Demo Doctor H07 047','doctor.h07.047@govcare.test','GCD-H07-DOC-047','govcare-demo-network-v1:h07:doctor:047','DEMO-WARD-047','$2a$10$2PxImP/RlAsqy2v8DnoFLufqTIH/xmKh0K818La96pVg9fUBgQ842'),
  (7,'doctor','Dr. Demo Doctor H07 048','doctor.h07.048@govcare.test','GCD-H07-DOC-048','govcare-demo-network-v1:h07:doctor:048','DEMO-WARD-048','$2a$10$rvK86D9UtpIEEdljJvmpyOLnbbxgrF3I0GnZAeyqfh3IHRB/alk0C'),
  (7,'doctor','Dr. Demo Doctor H07 049','doctor.h07.049@govcare.test','GCD-H07-DOC-049','govcare-demo-network-v1:h07:doctor:049','DEMO-WARD-049','$2a$10$kI/wAlvk1ffeEPrwDjq42O5uNc9wAjmdB2LweuDdv2CxlrJFNjBGS'),
  (7,'doctor','Dr. Demo Doctor H07 050','doctor.h07.050@govcare.test','GCD-H07-DOC-050','govcare-demo-network-v1:h07:doctor:050','DEMO-WARD-050','$2a$10$y31ZtDggtWLnuYrnjqdBcOpRukKQxI8uw6BSRKlfcvUMUL8inmjKC'),
  (7,'doctor','Dr. Demo Doctor H07 051','doctor.h07.051@govcare.test','GCD-H07-DOC-051','govcare-demo-network-v1:h07:doctor:051','DEMO-WARD-051','$2a$10$TeQxntcy6JV4vr9Im82wNODdF1gvhaWDxEBCX1B8HGgaY8g899YJG'),
  (7,'doctor','Dr. Demo Doctor H07 052','doctor.h07.052@govcare.test','GCD-H07-DOC-052','govcare-demo-network-v1:h07:doctor:052','DEMO-WARD-052','$2a$10$gY7xL.g7ipGU717OA7wEX.PhlDpTszLp5v4SVLLwFQRw3f45irN6a'),
  (7,'doctor','Dr. Demo Doctor H07 053','doctor.h07.053@govcare.test','GCD-H07-DOC-053','govcare-demo-network-v1:h07:doctor:053','DEMO-WARD-053','$2a$10$MVB5cKVdFgaiHuPucxXgUuEwh.Ox9hg6XPTheU91fH4qaTyJ9/Uxa'),
  (7,'doctor','Dr. Demo Doctor H07 054','doctor.h07.054@govcare.test','GCD-H07-DOC-054','govcare-demo-network-v1:h07:doctor:054','DEMO-WARD-054','$2a$10$BcU1OwLoYEqMLgB47yhIIewAHPCFLJ68Ouv23A2063MepIkeIvDN2'),
  (7,'doctor','Dr. Demo Doctor H07 055','doctor.h07.055@govcare.test','GCD-H07-DOC-055','govcare-demo-network-v1:h07:doctor:055','DEMO-WARD-055','$2a$10$/cEWRDqxve5BXMJRuFOJVeMKH4.qRYxgCaz3TakoGi3npCQvQsJza'),
  (7,'doctor','Dr. Demo Doctor H07 056','doctor.h07.056@govcare.test','GCD-H07-DOC-056','govcare-demo-network-v1:h07:doctor:056','DEMO-WARD-056','$2a$10$FeNDzX4t1LiYod6KVz2MUe/Br2SRzH/NNXeqnbBJQswTYTFzLzTti'),
  (7,'doctor','Dr. Demo Doctor H07 057','doctor.h07.057@govcare.test','GCD-H07-DOC-057','govcare-demo-network-v1:h07:doctor:057','DEMO-WARD-057','$2a$10$G8VEUulb7e/mmLRxNK6CNuMNVHt7fyqHbuIj7THOhBKX8LgOgM/Jy'),
  (7,'doctor','Dr. Demo Doctor H07 058','doctor.h07.058@govcare.test','GCD-H07-DOC-058','govcare-demo-network-v1:h07:doctor:058','DEMO-WARD-058','$2a$10$sBHU0JdqHC6BSAAFhDaDDOWXOW8e99vkEzUhZEBe2I9QqSeab.lLa'),
  (7,'doctor','Dr. Demo Doctor H07 059','doctor.h07.059@govcare.test','GCD-H07-DOC-059','govcare-demo-network-v1:h07:doctor:059','DEMO-WARD-059','$2a$10$BCaisqMbz1CZnZJRphVoTOhdNveN8vH2wDCLYplQ2qorzUpobDatS'),
  (7,'doctor','Dr. Demo Doctor H07 060','doctor.h07.060@govcare.test','GCD-H07-DOC-060','govcare-demo-network-v1:h07:doctor:060','DEMO-WARD-060','$2a$10$Q3mfEaDzYO9hcwEpIHZ1BeFpMR5.oXDV1aYkQ4aKVdrA38JGZJlsu'),
  (7,'doctor','Dr. Demo Doctor H07 061','doctor.h07.061@govcare.test','GCD-H07-DOC-061','govcare-demo-network-v1:h07:doctor:061','DEMO-WARD-061','$2a$10$Z6sAqPQaolB4v2.R6cuhEedVpHC0TOTNLnqOnG4uQktJDZs5EKIqi'),
  (7,'doctor','Dr. Demo Doctor H07 062','doctor.h07.062@govcare.test','GCD-H07-DOC-062','govcare-demo-network-v1:h07:doctor:062','DEMO-WARD-062','$2a$10$HXF7q8gqJ.OOhsivnOkYy.IO89IEKyiyHz872DW..lbdx1kMJxDci'),
  (7,'doctor','Dr. Demo Doctor H07 063','doctor.h07.063@govcare.test','GCD-H07-DOC-063','govcare-demo-network-v1:h07:doctor:063','DEMO-WARD-063','$2a$10$sfHwkYxDW3BfNL7HUiltMOxelcyFR5qeKziYky73kEhOWtjG.oUfm'),
  (7,'doctor','Dr. Demo Doctor H07 064','doctor.h07.064@govcare.test','GCD-H07-DOC-064','govcare-demo-network-v1:h07:doctor:064','DEMO-WARD-064','$2a$10$4Xya5ZFxredSSshQDOYiKOW27HOlYrbWBGDIm2sPsbzixWzjfxZXi'),
  (7,'doctor','Dr. Demo Doctor H07 065','doctor.h07.065@govcare.test','GCD-H07-DOC-065','govcare-demo-network-v1:h07:doctor:065','DEMO-WARD-065','$2a$10$scWyiecH.3D6OAiuIai6qeZ/5jT8eAYaYEfNIHvzO/hDCq/1OLpZi'),
  (7,'doctor','Dr. Demo Doctor H07 066','doctor.h07.066@govcare.test','GCD-H07-DOC-066','govcare-demo-network-v1:h07:doctor:066','DEMO-WARD-066','$2a$10$AS2XgJYqYR5pjG7IXded/efdUHuCvMyhG0kYhxnlHjCuQHOonTDte'),
  (7,'doctor','Dr. Demo Doctor H07 067','doctor.h07.067@govcare.test','GCD-H07-DOC-067','govcare-demo-network-v1:h07:doctor:067','DEMO-WARD-067','$2a$10$VD.IF.mMgRfKEei3TfdHtuwYSX6w/DQxAQjTfPFJbEjiPvQ9J/G.a'),
  (7,'doctor','Dr. Demo Doctor H07 068','doctor.h07.068@govcare.test','GCD-H07-DOC-068','govcare-demo-network-v1:h07:doctor:068','DEMO-WARD-068','$2a$10$wq1dX5qO9J1pCbWi0xsWo.GoctBom0opyI6z2s9X3LMiWLJH8a.fS'),
  (7,'doctor','Dr. Demo Doctor H07 069','doctor.h07.069@govcare.test','GCD-H07-DOC-069','govcare-demo-network-v1:h07:doctor:069','DEMO-WARD-069','$2a$10$Gj7pm3j8mS8VMXl6W7igEuxg1m43wvdiFppDH7KA2biXJoog7U1g.'),
  (7,'doctor','Dr. Demo Doctor H07 070','doctor.h07.070@govcare.test','GCD-H07-DOC-070','govcare-demo-network-v1:h07:doctor:070','DEMO-WARD-070','$2a$10$aO/IxHfZ6xH9Q00OUfHHvusEufvMdpSxuEYUSsJuZ3GKh9yhn64SS'),
  (7,'doctor','Dr. Demo Doctor H07 071','doctor.h07.071@govcare.test','GCD-H07-DOC-071','govcare-demo-network-v1:h07:doctor:071','DEMO-WARD-071','$2a$10$i6ZWaC1czaolXPpUEHTp8e9daQRw8vz42SjuWmyRIXzua6dOxHDXe'),
  (7,'doctor','Dr. Demo Doctor H07 072','doctor.h07.072@govcare.test','GCD-H07-DOC-072','govcare-demo-network-v1:h07:doctor:072','DEMO-WARD-072','$2a$10$fcbCFygKOEln.YjScFUKU.BWxzERTP.Ao2dZAK74.PX5ivbE0p69m'),
  (7,'doctor','Dr. Demo Doctor H07 073','doctor.h07.073@govcare.test','GCD-H07-DOC-073','govcare-demo-network-v1:h07:doctor:073','DEMO-WARD-073','$2a$10$sYf.aeNxAUPUiOo1M8B1F.7bE0NQwzHU7CghoXmd8ZONvnWe/lkyG'),
  (7,'doctor','Dr. Demo Doctor H07 074','doctor.h07.074@govcare.test','GCD-H07-DOC-074','govcare-demo-network-v1:h07:doctor:074','DEMO-WARD-074','$2a$10$130qRixulujQRCsy3ccDFeXh38SoQbooOXmiWsK3pWWRlLwKij0JG'),
  (7,'doctor','Dr. Demo Doctor H07 075','doctor.h07.075@govcare.test','GCD-H07-DOC-075','govcare-demo-network-v1:h07:doctor:075','DEMO-WARD-075','$2a$10$pRQiCS1hL43FKzQKrYTTzuWeNfr6K5aEhWIsJXeJQrfrfSUo4sINa'),
  (7,'doctor','Dr. Demo Doctor H07 076','doctor.h07.076@govcare.test','GCD-H07-DOC-076','govcare-demo-network-v1:h07:doctor:076','DEMO-WARD-076','$2a$10$9q2ZFpkQre3.ws.4qmDAk.FWJLlTx0z8KvyradppKovucffde9Q7m'),
  (7,'doctor','Dr. Demo Doctor H07 077','doctor.h07.077@govcare.test','GCD-H07-DOC-077','govcare-demo-network-v1:h07:doctor:077','DEMO-WARD-077','$2a$10$Q2tbe7HVHCMx.cpS93keBepy1ZSLQnYp32MyhJd.6pL9ifjyTVkkW'),
  (7,'doctor','Dr. Demo Doctor H07 078','doctor.h07.078@govcare.test','GCD-H07-DOC-078','govcare-demo-network-v1:h07:doctor:078','DEMO-WARD-078','$2a$10$1BrdsCBgjgN7E2/rXJu3ae2kbMVbWU9V26B9DJWyXUKe55CUqsPDS'),
  (7,'doctor','Dr. Demo Doctor H07 079','doctor.h07.079@govcare.test','GCD-H07-DOC-079','govcare-demo-network-v1:h07:doctor:079','DEMO-WARD-079','$2a$10$YVR2ojZSAxGsdUIcvS5QpOy52Xbq7NLGvuthhjCRP6BO/gRjtwpiq'),
  (7,'doctor','Dr. Demo Doctor H07 080','doctor.h07.080@govcare.test','GCD-H07-DOC-080','govcare-demo-network-v1:h07:doctor:080','DEMO-WARD-080','$2a$10$huMEi6nsuPFlNil87BCk3./sZt.liJqya.TQ1K8Ffxhyip/ewYzHC'),
  (7,'doctor','Dr. Demo Doctor H07 081','doctor.h07.081@govcare.test','GCD-H07-DOC-081','govcare-demo-network-v1:h07:doctor:081','DEMO-WARD-081','$2a$10$/XX5Y7u9m1rmdZtMtX9KueCvlEVuy7S38N79rBEnedRXkyuGO/gKW'),
  (7,'doctor','Dr. Demo Doctor H07 082','doctor.h07.082@govcare.test','GCD-H07-DOC-082','govcare-demo-network-v1:h07:doctor:082','DEMO-WARD-082','$2a$10$gSE6dao2hPaPepcNpskQGu8wJN61R6k1Yfe76j8btJRZffOqEBUiK'),
  (7,'doctor','Dr. Demo Doctor H07 083','doctor.h07.083@govcare.test','GCD-H07-DOC-083','govcare-demo-network-v1:h07:doctor:083','DEMO-WARD-083','$2a$10$wpoaaAAySQCbVZBqIYJk3u6ww9Utrh4ghDCxUnIXauicxAxPtvw3i'),
  (7,'doctor','Dr. Demo Doctor H07 084','doctor.h07.084@govcare.test','GCD-H07-DOC-084','govcare-demo-network-v1:h07:doctor:084','DEMO-WARD-084','$2a$10$tHkDQkLxg1qkc.oWkT5P/.V6tXrOJ4705yLogHXKbiY8p3tMI1HYq'),
  (7,'doctor','Dr. Demo Doctor H07 085','doctor.h07.085@govcare.test','GCD-H07-DOC-085','govcare-demo-network-v1:h07:doctor:085','DEMO-WARD-085','$2a$10$y145vdIqt.B5W/CbEaLNi.5gI0TBdhwbDAPx6NNdV6AdtC5RcEVaG'),
  (7,'doctor','Dr. Demo Doctor H07 086','doctor.h07.086@govcare.test','GCD-H07-DOC-086','govcare-demo-network-v1:h07:doctor:086','DEMO-WARD-086','$2a$10$FC/bcTNl7//6geptPrXbM.GF9DhYUG7r1qI5dY.SyufK3tdpDSwze'),
  (7,'doctor','Dr. Demo Doctor H07 087','doctor.h07.087@govcare.test','GCD-H07-DOC-087','govcare-demo-network-v1:h07:doctor:087','DEMO-WARD-087','$2a$10$JTiJgtn0yVkaIewx3yrGke1A8kBz9yB8O/EH78NaACQHWwBVUn9Jq'),
  (7,'doctor','Dr. Demo Doctor H07 088','doctor.h07.088@govcare.test','GCD-H07-DOC-088','govcare-demo-network-v1:h07:doctor:088','DEMO-WARD-088','$2a$10$Gu4F0/2KM7JWiJb3inTmzeBGxCjxrZvl2vToizhWcaY6UKqfCnIka'),
  (7,'doctor','Dr. Demo Doctor H07 089','doctor.h07.089@govcare.test','GCD-H07-DOC-089','govcare-demo-network-v1:h07:doctor:089','DEMO-WARD-089','$2a$10$rp3/wvbqauiDUGGOo5NEsuaF.WQx5fn0syEYXOfttap2HUTrFeDuG'),
  (7,'doctor','Dr. Demo Doctor H07 090','doctor.h07.090@govcare.test','GCD-H07-DOC-090','govcare-demo-network-v1:h07:doctor:090','DEMO-WARD-090','$2a$10$1vImhoNjiohokBGHrZMrz.W82xbNpZiNSl2nZ7rIEfJtSkvye6nKS'),
  (7,'doctor','Dr. Demo Doctor H07 091','doctor.h07.091@govcare.test','GCD-H07-DOC-091','govcare-demo-network-v1:h07:doctor:091','DEMO-WARD-091','$2a$10$CiEY3z2W/IN4guAm2bTslOOodPw9uX03GpJLBIC5YnhjL3kEQ5C3K'),
  (7,'doctor','Dr. Demo Doctor H07 092','doctor.h07.092@govcare.test','GCD-H07-DOC-092','govcare-demo-network-v1:h07:doctor:092','DEMO-WARD-092','$2a$10$/O4tRLZKWT5smolyLWNPM.RqYJtX45UpKFLJ1t/jU5CddvxKNbOWS'),
  (7,'doctor','Dr. Demo Doctor H07 093','doctor.h07.093@govcare.test','GCD-H07-DOC-093','govcare-demo-network-v1:h07:doctor:093','DEMO-WARD-093','$2a$10$ezLQGg7A.MpKBBGRRt8gLustCpv90PPo38OW7vYLWgmturmyEyMcq'),
  (7,'doctor','Dr. Demo Doctor H07 094','doctor.h07.094@govcare.test','GCD-H07-DOC-094','govcare-demo-network-v1:h07:doctor:094','DEMO-WARD-094','$2a$10$IlJZ5VHs09qnZ5mVtdB42eXVUx.8xJinrdngqHR1R8bOJUgMbWKW6'),
  (7,'doctor','Dr. Demo Doctor H07 095','doctor.h07.095@govcare.test','GCD-H07-DOC-095','govcare-demo-network-v1:h07:doctor:095','DEMO-WARD-095','$2a$10$I0naQDCu7nSmfpNPeAjbsutTXylBgRWGqKkoaKFXcESJvahKWraPW'),
  (7,'doctor','Dr. Demo Doctor H07 096','doctor.h07.096@govcare.test','GCD-H07-DOC-096','govcare-demo-network-v1:h07:doctor:096','DEMO-WARD-096','$2a$10$XE18MEraX1UCtGoW3D/qLufryz9ZKNJubRD0U2qxgdndZSZyTCpAS'),
  (7,'doctor','Dr. Demo Doctor H07 097','doctor.h07.097@govcare.test','GCD-H07-DOC-097','govcare-demo-network-v1:h07:doctor:097','DEMO-WARD-097','$2a$10$Xb.qcX/kxysRQHG9zYlRDu7u6jVuBr8CNSPk27KS95EaiGs5fVbzC'),
  (7,'doctor','Dr. Demo Doctor H07 098','doctor.h07.098@govcare.test','GCD-H07-DOC-098','govcare-demo-network-v1:h07:doctor:098','DEMO-WARD-098','$2a$10$IP6a768Y8aGni793vFZqGekHVRQurn6U3ZdtRwnHYC6l7j.DNaFrm'),
  (7,'doctor','Dr. Demo Doctor H07 099','doctor.h07.099@govcare.test','GCD-H07-DOC-099','govcare-demo-network-v1:h07:doctor:099','DEMO-WARD-099','$2a$10$onuUcTjZtL0SPS3XjHgeYu9l4xcjFSeZM9at9EEhZU.JWWaO/quNa'),
  (7,'doctor','Dr. Demo Doctor H07 100','doctor.h07.100@govcare.test','GCD-H07-DOC-100','govcare-demo-network-v1:h07:doctor:100','DEMO-WARD-100','$2a$10$iOKh/ucuyV6/gGIDR6p1keKx./l41itnlKWauZfZJuZjj6SFqJcRi'),
  (7,'hospital_admin','Demo Hospital Admin H07','admin.h07@govcare.test','GCD-H07-ADMIN','govcare-demo-network-v1:h07:hospital_admin','ADMIN','$2a$10$jc1K/HRh1J6e.Gc9MyuvCe.7X0cBguS4vw95EGc1NEqrpUBK0gQnS'),
  (7,'receptionist','Demo Front Desk Officer H07','reception.h07@govcare.test','GCD-H07-RECEPTION','govcare-demo-network-v1:h07:receptionist','RECEPTION','$2a$10$2AIOpCwZ61xttyUd79AIo.c5RJgV1oj.oFxw0bZRBTkVaj.xkHMLm'),
  (7,'nurse','Demo Nurse H07','nurse.h07@govcare.test','GCD-H07-NURSE','govcare-demo-network-v1:h07:nurse','DEMO-WARD-001','$2a$10$xqbkvbUZSqdPqQOAgBx1hODiGzT4ONJQQXMiXNiJSjbds2ol6BiDO'),
  (7,'ward_manager','Demo Ward Manager H07','wardmanager.h07@govcare.test','GCD-H07-WARDMANAGER','govcare-demo-network-v1:h07:ward_manager','DEMO-WARD-001','$2a$10$9jKJbXyv9aO7TFoFaTkX7.hIPmJi7rGpOjhsR28XqXugbnqh8Bet6'),
  (7,'patient','Demo Patient Portal User H07','patient.h07@govcare.test','GCD-H07-PATIENT','govcare-demo-network-v1:h07:patient',null,'$2a$10$hALFtOsMZ2h16R/uCOG0h.jZ97QI24OhPUwBf2KqomrfVmRilZFIO'),
  (7,'guardian','Demo Guardian Portal User H07','guardian.h07@govcare.test','GCD-H07-GUARDIAN','govcare-demo-network-v1:h07:guardian',null,'$2a$10$B/sIi23qMrO1GFhobCaPH.fVC6Rja2EZk1BH3v9bqEUYiFLhedDVG'),
  (8,'doctor','Dr. Demo Doctor H08 001','doctor.h08.001@govcare.test','GCD-H08-DOC-001','govcare-demo-network-v1:h08:doctor:001','DEMO-WARD-001','$2a$10$QsreQAlZAulH4sN0jLKAMOssM.Gxx4h0Ib42vSMi5WelVNUUM6hvW'),
  (8,'doctor','Dr. Demo Doctor H08 002','doctor.h08.002@govcare.test','GCD-H08-DOC-002','govcare-demo-network-v1:h08:doctor:002','DEMO-WARD-002','$2a$10$F76/LaQfCAMAb0/AeKdcoecgx0kL4iUddEdQQto36jZi85rSMxB.2'),
  (8,'doctor','Dr. Demo Doctor H08 003','doctor.h08.003@govcare.test','GCD-H08-DOC-003','govcare-demo-network-v1:h08:doctor:003','DEMO-WARD-003','$2a$10$IeEmnMFw2/BkUPPFZkFSwOcPc9U0uL8JEXrGkCbWTQ/51e.0sTnx2'),
  (8,'doctor','Dr. Demo Doctor H08 004','doctor.h08.004@govcare.test','GCD-H08-DOC-004','govcare-demo-network-v1:h08:doctor:004','DEMO-WARD-004','$2a$10$5h05YQPFaAw4HEi5ceepDejVgpmTTnbJsnPI48/B1BGMhRK9Jhwk2'),
  (8,'doctor','Dr. Demo Doctor H08 005','doctor.h08.005@govcare.test','GCD-H08-DOC-005','govcare-demo-network-v1:h08:doctor:005','DEMO-WARD-005','$2a$10$FnOCeCyKnWa0sXix9/TGOu6IE5V7uaCgv/ILpD5344w26EL/6YKNy'),
  (8,'doctor','Dr. Demo Doctor H08 006','doctor.h08.006@govcare.test','GCD-H08-DOC-006','govcare-demo-network-v1:h08:doctor:006','DEMO-WARD-006','$2a$10$WkH.LHyWVQjLyFDPloa5COj6.5Z7tv/8FIQwM6KAN1IY./I1/tjz2'),
  (8,'doctor','Dr. Demo Doctor H08 007','doctor.h08.007@govcare.test','GCD-H08-DOC-007','govcare-demo-network-v1:h08:doctor:007','DEMO-WARD-007','$2a$10$6oSOVxCRyfkkB6aQLLLRUOnoN/hhq9dfsYLyxY6QQyWqJNG4Lwb9q'),
  (8,'doctor','Dr. Demo Doctor H08 008','doctor.h08.008@govcare.test','GCD-H08-DOC-008','govcare-demo-network-v1:h08:doctor:008','DEMO-WARD-008','$2a$10$fXNt/EVuVK9Hf3XHBOL/cuksJJ814D315eIpzbiIXB6QojrtBdt.2'),
  (8,'doctor','Dr. Demo Doctor H08 009','doctor.h08.009@govcare.test','GCD-H08-DOC-009','govcare-demo-network-v1:h08:doctor:009','DEMO-WARD-009','$2a$10$YW8KQwOr8ZnTfxhzKQbJhuJww1Nw8RyawyWidDD0A0nZCdKCPclYy'),
  (8,'doctor','Dr. Demo Doctor H08 010','doctor.h08.010@govcare.test','GCD-H08-DOC-010','govcare-demo-network-v1:h08:doctor:010','DEMO-WARD-010','$2a$10$mAUgUcSUhugZqucL5qZR4eCB6PRpxU4LJLQlHCgbm22sMBdNRcfuy'),
  (8,'doctor','Dr. Demo Doctor H08 011','doctor.h08.011@govcare.test','GCD-H08-DOC-011','govcare-demo-network-v1:h08:doctor:011','DEMO-WARD-011','$2a$10$CQ3m2OECP91C77POyt.c1uPNMlYchtVjuCxEDkrzPCdikbRNzk6nC'),
  (8,'doctor','Dr. Demo Doctor H08 012','doctor.h08.012@govcare.test','GCD-H08-DOC-012','govcare-demo-network-v1:h08:doctor:012','DEMO-WARD-012','$2a$10$50a48dY4J/Z1eMuzl3nrXOAYOfN.gOymDaS8Dx0DHbZS3/yik8JFC'),
  (8,'doctor','Dr. Demo Doctor H08 013','doctor.h08.013@govcare.test','GCD-H08-DOC-013','govcare-demo-network-v1:h08:doctor:013','DEMO-WARD-013','$2a$10$HPignHRIpbJsuqY0R4lK0uIkhvbi.0rrX5.0SRECYEtru9jvrc29S'),
  (8,'doctor','Dr. Demo Doctor H08 014','doctor.h08.014@govcare.test','GCD-H08-DOC-014','govcare-demo-network-v1:h08:doctor:014','DEMO-WARD-014','$2a$10$A47CYkXuKA2Q16DQX/XtIOpyYIhd61kFVNbXMvz8QprTbjFk.Ledu'),
  (8,'doctor','Dr. Demo Doctor H08 015','doctor.h08.015@govcare.test','GCD-H08-DOC-015','govcare-demo-network-v1:h08:doctor:015','DEMO-WARD-015','$2a$10$/n9n/pvoTp5nmM6eU9kDGuSgp5gTt6qkO9FQMrVEaxahOwKz.sd0K'),
  (8,'doctor','Dr. Demo Doctor H08 016','doctor.h08.016@govcare.test','GCD-H08-DOC-016','govcare-demo-network-v1:h08:doctor:016','DEMO-WARD-016','$2a$10$OvE7gYTu9dOSTkQhCAJdY.vl3Q/pohKF6pH/rWZ73C5ngXD6BOpkC'),
  (8,'doctor','Dr. Demo Doctor H08 017','doctor.h08.017@govcare.test','GCD-H08-DOC-017','govcare-demo-network-v1:h08:doctor:017','DEMO-WARD-017','$2a$10$m3bwGVKpQvvG/XLJNKTCT.BDq9qOG4DsX/7UuUw7XrkfQKiQh4H4y'),
  (8,'doctor','Dr. Demo Doctor H08 018','doctor.h08.018@govcare.test','GCD-H08-DOC-018','govcare-demo-network-v1:h08:doctor:018','DEMO-WARD-018','$2a$10$gDmTmwcqRiVsKpSehVTaY.S7kOz9DEQ1yXfcMwl7JBxqNBdOm.Wca'),
  (8,'doctor','Dr. Demo Doctor H08 019','doctor.h08.019@govcare.test','GCD-H08-DOC-019','govcare-demo-network-v1:h08:doctor:019','DEMO-WARD-019','$2a$10$NYiNZNtASaSJeRNEsHWWQOF9B5DeZkJzm7Y8X/7vswLcbqiMEhpOa'),
  (8,'doctor','Dr. Demo Doctor H08 020','doctor.h08.020@govcare.test','GCD-H08-DOC-020','govcare-demo-network-v1:h08:doctor:020','DEMO-WARD-020','$2a$10$/85RpXKjOabwnVCoqUQvn.ZzrwMTQqKE8cZpm4hbd/lB.q1RssfA2'),
  (8,'doctor','Dr. Demo Doctor H08 021','doctor.h08.021@govcare.test','GCD-H08-DOC-021','govcare-demo-network-v1:h08:doctor:021','DEMO-WARD-021','$2a$10$pA.YCkWbbWi9ctt6JCVejemDypEXT85GBO3TaSbAsVU/3WJBuPxaW'),
  (8,'doctor','Dr. Demo Doctor H08 022','doctor.h08.022@govcare.test','GCD-H08-DOC-022','govcare-demo-network-v1:h08:doctor:022','DEMO-WARD-022','$2a$10$fpzqX/bhz0JW0HkdicTx5e.V9tUEAAhvfU7u4h/9MheuAl8YsI/DO'),
  (8,'doctor','Dr. Demo Doctor H08 023','doctor.h08.023@govcare.test','GCD-H08-DOC-023','govcare-demo-network-v1:h08:doctor:023','DEMO-WARD-023','$2a$10$M96ls6OULAEUX3liqmZz7O2E3.pJZhoxRp4g7RhoaV/DT1uteZMR2'),
  (8,'doctor','Dr. Demo Doctor H08 024','doctor.h08.024@govcare.test','GCD-H08-DOC-024','govcare-demo-network-v1:h08:doctor:024','DEMO-WARD-024','$2a$10$LAr8EtA0IBXu2PNvR08JcOnLeoVgNiuRIkDI0jCqrhllm5DiSLlla'),
  (8,'doctor','Dr. Demo Doctor H08 025','doctor.h08.025@govcare.test','GCD-H08-DOC-025','govcare-demo-network-v1:h08:doctor:025','DEMO-WARD-025','$2a$10$sfaZLHQgEGv.70vGAiTmyOOOXP.XHkh3mqLindNc0L0vD0FECQsji'),
  (8,'doctor','Dr. Demo Doctor H08 026','doctor.h08.026@govcare.test','GCD-H08-DOC-026','govcare-demo-network-v1:h08:doctor:026','DEMO-WARD-026','$2a$10$3ul7ISnEyBXQzSNStTXIN.UGfsLXxy2tJBExifELAhXCGHR6HHdxy'),
  (8,'doctor','Dr. Demo Doctor H08 027','doctor.h08.027@govcare.test','GCD-H08-DOC-027','govcare-demo-network-v1:h08:doctor:027','DEMO-WARD-027','$2a$10$WMKYYw5RFNrn8izNcmKZBOPAchm7LcEhJBQy8sFBBxigHTMzBcjPu'),
  (8,'doctor','Dr. Demo Doctor H08 028','doctor.h08.028@govcare.test','GCD-H08-DOC-028','govcare-demo-network-v1:h08:doctor:028','DEMO-WARD-028','$2a$10$Ob76TjT0P6HuHagdu14b5ucsTWchJFb8BeRWG/UiqaCWjR..CTBM2'),
  (8,'doctor','Dr. Demo Doctor H08 029','doctor.h08.029@govcare.test','GCD-H08-DOC-029','govcare-demo-network-v1:h08:doctor:029','DEMO-WARD-029','$2a$10$gdxjrP4kHOAb67ALJmMTMeRshnaJKzAh.QUQ8/S94B7Vr3n6.7K5C'),
  (8,'doctor','Dr. Demo Doctor H08 030','doctor.h08.030@govcare.test','GCD-H08-DOC-030','govcare-demo-network-v1:h08:doctor:030','DEMO-WARD-030','$2a$10$sHVFN4uNPEDMtdGnJzl4w.l5Iopl7S8PdhtM9o3r2QvqJv0aWnov2'),
  (8,'doctor','Dr. Demo Doctor H08 031','doctor.h08.031@govcare.test','GCD-H08-DOC-031','govcare-demo-network-v1:h08:doctor:031','DEMO-WARD-031','$2a$10$DEf94YZOe4rE29CYQpRxGeOyEgU6hUi/89z/UyHKWSSQzuQ9nr4pa'),
  (8,'doctor','Dr. Demo Doctor H08 032','doctor.h08.032@govcare.test','GCD-H08-DOC-032','govcare-demo-network-v1:h08:doctor:032','DEMO-WARD-032','$2a$10$5QldyoiSbmi5zUBN7aBF0uByAkj.opfXs7l47p6bR66r.sq/u9Q6e'),
  (8,'doctor','Dr. Demo Doctor H08 033','doctor.h08.033@govcare.test','GCD-H08-DOC-033','govcare-demo-network-v1:h08:doctor:033','DEMO-WARD-033','$2a$10$OILQvbfqSAFq/tCIw5WCzemxWj7VyayxeNITcyJvjNRSVwFRIijmO'),
  (8,'doctor','Dr. Demo Doctor H08 034','doctor.h08.034@govcare.test','GCD-H08-DOC-034','govcare-demo-network-v1:h08:doctor:034','DEMO-WARD-034','$2a$10$/1x1ZdZhk.lX0VL3/s2q1.Do4qJLcMFtHFAqTBR9O3XAojSJArl4u'),
  (8,'doctor','Dr. Demo Doctor H08 035','doctor.h08.035@govcare.test','GCD-H08-DOC-035','govcare-demo-network-v1:h08:doctor:035','DEMO-WARD-035','$2a$10$W4DZxfPHrZVvVywP7FTcV.toCNQbDFLAbxoRc9lPey77Bh0Z2sbS6'),
  (8,'doctor','Dr. Demo Doctor H08 036','doctor.h08.036@govcare.test','GCD-H08-DOC-036','govcare-demo-network-v1:h08:doctor:036','DEMO-WARD-036','$2a$10$QtRBGHeCbvaaFiDhufl8FOu90uQOm6TjFMNn9PouNVvLi8ggonby.'),
  (8,'doctor','Dr. Demo Doctor H08 037','doctor.h08.037@govcare.test','GCD-H08-DOC-037','govcare-demo-network-v1:h08:doctor:037','DEMO-WARD-037','$2a$10$hHhiyx/0oeZDp.guzwMy1.AAJhXshCfBZbb2HNq7X6qb7lk1PoYWG'),
  (8,'doctor','Dr. Demo Doctor H08 038','doctor.h08.038@govcare.test','GCD-H08-DOC-038','govcare-demo-network-v1:h08:doctor:038','DEMO-WARD-038','$2a$10$i8TuJO3LuKdfq.xipDb6se8kZYAaDNSQIE.ZCzRS9BV7fJF.ssRPq'),
  (8,'doctor','Dr. Demo Doctor H08 039','doctor.h08.039@govcare.test','GCD-H08-DOC-039','govcare-demo-network-v1:h08:doctor:039','DEMO-WARD-039','$2a$10$GmMS/10/wxrVCPCQnkQh9OHI.fD8l30ln8EhW77rOv.cP6YbMREF.'),
  (8,'doctor','Dr. Demo Doctor H08 040','doctor.h08.040@govcare.test','GCD-H08-DOC-040','govcare-demo-network-v1:h08:doctor:040','DEMO-WARD-040','$2a$10$WK3hD6uTT/usMrJL6g6/Xu8zVP2h1HsuwwikQwPhnESmjiuX4QkiC'),
  (8,'doctor','Dr. Demo Doctor H08 041','doctor.h08.041@govcare.test','GCD-H08-DOC-041','govcare-demo-network-v1:h08:doctor:041','DEMO-WARD-041','$2a$10$Pnl0NPqK3RSI6VJu8oQuB.JaSvogSVrcH3tdM6r7WxmpKGSIMngUi'),
  (8,'doctor','Dr. Demo Doctor H08 042','doctor.h08.042@govcare.test','GCD-H08-DOC-042','govcare-demo-network-v1:h08:doctor:042','DEMO-WARD-042','$2a$10$tyOy4ZWWYpsn.iKKpPza3ORDZ3GVQR9BSxb/epOPvRGMOL9jO2mvu'),
  (8,'doctor','Dr. Demo Doctor H08 043','doctor.h08.043@govcare.test','GCD-H08-DOC-043','govcare-demo-network-v1:h08:doctor:043','DEMO-WARD-043','$2a$10$pMS330J0.bMG5O/fp79KbO3qwNOI/EY7cLlA7quOQnIeWRry4F9oG'),
  (8,'doctor','Dr. Demo Doctor H08 044','doctor.h08.044@govcare.test','GCD-H08-DOC-044','govcare-demo-network-v1:h08:doctor:044','DEMO-WARD-044','$2a$10$xNm.5eBtXa1phzyyCSW8O.njXDoXHlsq9KGv/b2iHHwAN6swTsNVi'),
  (8,'doctor','Dr. Demo Doctor H08 045','doctor.h08.045@govcare.test','GCD-H08-DOC-045','govcare-demo-network-v1:h08:doctor:045','DEMO-WARD-045','$2a$10$wJrD95uugB4hv.720mf00OjpeICRf6Io6isGyCl8jYn/HUycZ.V72'),
  (8,'doctor','Dr. Demo Doctor H08 046','doctor.h08.046@govcare.test','GCD-H08-DOC-046','govcare-demo-network-v1:h08:doctor:046','DEMO-WARD-046','$2a$10$KrREG7shKVOBYQnBasaZNenRtjJnK4yafrl6tDxTH4uMvFj5YPxvy'),
  (8,'doctor','Dr. Demo Doctor H08 047','doctor.h08.047@govcare.test','GCD-H08-DOC-047','govcare-demo-network-v1:h08:doctor:047','DEMO-WARD-047','$2a$10$2GxDzCyj7zVS5MCV2spIqesA9M/PZozZuzdSnnEW7nPHSVB5KDVNe'),
  (8,'doctor','Dr. Demo Doctor H08 048','doctor.h08.048@govcare.test','GCD-H08-DOC-048','govcare-demo-network-v1:h08:doctor:048','DEMO-WARD-048','$2a$10$NOWxJs4M7dH3VCvz42M.yOarGj.I4pJhC2bAShMA1Wkjo3fu56.2G'),
  (8,'doctor','Dr. Demo Doctor H08 049','doctor.h08.049@govcare.test','GCD-H08-DOC-049','govcare-demo-network-v1:h08:doctor:049','DEMO-WARD-049','$2a$10$DqbhOTuuFNQ9DqbMpCmUbuEGPTBTHNczF.18d/JeMKw1ruGtwCuRC'),
  (8,'doctor','Dr. Demo Doctor H08 050','doctor.h08.050@govcare.test','GCD-H08-DOC-050','govcare-demo-network-v1:h08:doctor:050','DEMO-WARD-050','$2a$10$Tl4kGq08XwwicmavGAAFbugCfrFR/0r8pKl/kutc7MmGgBRVGv8aC'),
  (8,'doctor','Dr. Demo Doctor H08 051','doctor.h08.051@govcare.test','GCD-H08-DOC-051','govcare-demo-network-v1:h08:doctor:051','DEMO-WARD-051','$2a$10$6sf8kH52d8SIpXM4GFhkT.y7cIZPYQ384fXkGAWjvS8r6P.juqgfa'),
  (8,'doctor','Dr. Demo Doctor H08 052','doctor.h08.052@govcare.test','GCD-H08-DOC-052','govcare-demo-network-v1:h08:doctor:052','DEMO-WARD-052','$2a$10$hRZ8cnhprS.ZokSpvdY1FeMwmgp6/Xe0nhY6lrmAKGf6OG9dSVSyS'),
  (8,'doctor','Dr. Demo Doctor H08 053','doctor.h08.053@govcare.test','GCD-H08-DOC-053','govcare-demo-network-v1:h08:doctor:053','DEMO-WARD-053','$2a$10$xWY6dJ0wIVDt4z7FoTrsSO6nlXa0DmbUEOKdCmSFSPgOzjylXWUxe'),
  (8,'doctor','Dr. Demo Doctor H08 054','doctor.h08.054@govcare.test','GCD-H08-DOC-054','govcare-demo-network-v1:h08:doctor:054','DEMO-WARD-054','$2a$10$PfltCFUOkTwPinU54NC5se1iPNtdX/3kgzDZ5w669O7tte9vmTHFK'),
  (8,'doctor','Dr. Demo Doctor H08 055','doctor.h08.055@govcare.test','GCD-H08-DOC-055','govcare-demo-network-v1:h08:doctor:055','DEMO-WARD-055','$2a$10$t37vnhwjnwe55NY04DqGGeSOeHXl5td89MReNzpSjXlKRvs9Hit4y'),
  (8,'doctor','Dr. Demo Doctor H08 056','doctor.h08.056@govcare.test','GCD-H08-DOC-056','govcare-demo-network-v1:h08:doctor:056','DEMO-WARD-056','$2a$10$gYBaKC7WSjbukbEBjtWWAObFv/pSrL76i1Kwlsz9LwpmpVQpwNz0W'),
  (8,'doctor','Dr. Demo Doctor H08 057','doctor.h08.057@govcare.test','GCD-H08-DOC-057','govcare-demo-network-v1:h08:doctor:057','DEMO-WARD-057','$2a$10$ouAHYkAvPNcUkfQgzWa/pOsVMOlTd6rha1j8VlmvfH7ycKglAelPG'),
  (8,'doctor','Dr. Demo Doctor H08 058','doctor.h08.058@govcare.test','GCD-H08-DOC-058','govcare-demo-network-v1:h08:doctor:058','DEMO-WARD-058','$2a$10$Vaoya6SCzDy/ms.3R0/jhOlu1lHiNMl5Z4SRUppjzMR13gXxnty6C'),
  (8,'doctor','Dr. Demo Doctor H08 059','doctor.h08.059@govcare.test','GCD-H08-DOC-059','govcare-demo-network-v1:h08:doctor:059','DEMO-WARD-059','$2a$10$EPw9iTKngSGegAegi/6SU.LRgRsGi3dVnvDcRjiX6zZrboHm6P5BK'),
  (8,'doctor','Dr. Demo Doctor H08 060','doctor.h08.060@govcare.test','GCD-H08-DOC-060','govcare-demo-network-v1:h08:doctor:060','DEMO-WARD-060','$2a$10$FW3szv7sQ/6Gtj8Ob5EmO.4GQnOaPj5GU6LCj/gL5svl7AvvjbYC.'),
  (8,'doctor','Dr. Demo Doctor H08 061','doctor.h08.061@govcare.test','GCD-H08-DOC-061','govcare-demo-network-v1:h08:doctor:061','DEMO-WARD-061','$2a$10$A2FECVx8zZ7ZOXt1gU1FNeimVFsLNeNW.lQbSV.7i5EQK3h3bRMBa'),
  (8,'doctor','Dr. Demo Doctor H08 062','doctor.h08.062@govcare.test','GCD-H08-DOC-062','govcare-demo-network-v1:h08:doctor:062','DEMO-WARD-062','$2a$10$oVYmJ8ib5RU45qiKalsu3e7rBC0ytqz.e5YUj/cDmHti2PH3.E3Vu'),
  (8,'doctor','Dr. Demo Doctor H08 063','doctor.h08.063@govcare.test','GCD-H08-DOC-063','govcare-demo-network-v1:h08:doctor:063','DEMO-WARD-063','$2a$10$7JEQ38WqhlhZspOprBZFMuuzVo0VyJ22kns9N7oytcEospT4KPqxS'),
  (8,'doctor','Dr. Demo Doctor H08 064','doctor.h08.064@govcare.test','GCD-H08-DOC-064','govcare-demo-network-v1:h08:doctor:064','DEMO-WARD-064','$2a$10$RtQRlyisOL776Ox5/L3MFeViEqCjrk4EUQhHy9WxK7V.VgwfuTVBm'),
  (8,'doctor','Dr. Demo Doctor H08 065','doctor.h08.065@govcare.test','GCD-H08-DOC-065','govcare-demo-network-v1:h08:doctor:065','DEMO-WARD-065','$2a$10$HykhflDn3LNLXGOjaQb2w.ZjfERL8fxYQbwAN6lkJBLPH.rxQulN.'),
  (8,'doctor','Dr. Demo Doctor H08 066','doctor.h08.066@govcare.test','GCD-H08-DOC-066','govcare-demo-network-v1:h08:doctor:066','DEMO-WARD-066','$2a$10$CrRM/7gg6MhDk0yqUS4d.O5B17ZKNzBwsKudiist.fGg5AUnmMmEe'),
  (8,'doctor','Dr. Demo Doctor H08 067','doctor.h08.067@govcare.test','GCD-H08-DOC-067','govcare-demo-network-v1:h08:doctor:067','DEMO-WARD-067','$2a$10$Ol2t.9aYsVy8G3GDC4Ea4.7N0fD1GtTD/tZnsnuCe6N56TXTsdp1e'),
  (8,'doctor','Dr. Demo Doctor H08 068','doctor.h08.068@govcare.test','GCD-H08-DOC-068','govcare-demo-network-v1:h08:doctor:068','DEMO-WARD-068','$2a$10$mUaELLq.eR0GiZBclzzf3e5K7E5CiLbnTiwGM6HtO.4XVd.vGsGLa'),
  (8,'doctor','Dr. Demo Doctor H08 069','doctor.h08.069@govcare.test','GCD-H08-DOC-069','govcare-demo-network-v1:h08:doctor:069','DEMO-WARD-069','$2a$10$RTfX4Ovv9MHmiMcZVxueAu5gK2yjVqaqS1Yoz7DO90YDqgYtibr52'),
  (8,'doctor','Dr. Demo Doctor H08 070','doctor.h08.070@govcare.test','GCD-H08-DOC-070','govcare-demo-network-v1:h08:doctor:070','DEMO-WARD-070','$2a$10$FbvQy5GEzcLoKBKR0FVhf.EtKAgDVol9LsIjpSNR/aEW8sZqoJr.e'),
  (8,'doctor','Dr. Demo Doctor H08 071','doctor.h08.071@govcare.test','GCD-H08-DOC-071','govcare-demo-network-v1:h08:doctor:071','DEMO-WARD-071','$2a$10$2UN7ZBQBmw1yVvWjX2zbROv9Iak5GTrFy1.j26We4c3dGVtqLNaA6'),
  (8,'doctor','Dr. Demo Doctor H08 072','doctor.h08.072@govcare.test','GCD-H08-DOC-072','govcare-demo-network-v1:h08:doctor:072','DEMO-WARD-072','$2a$10$Dmh7RQnpYrZiQXx3RcbfMOD8AkAt8pNQRyQGniL/hxoiuf2bQQ/ve'),
  (8,'doctor','Dr. Demo Doctor H08 073','doctor.h08.073@govcare.test','GCD-H08-DOC-073','govcare-demo-network-v1:h08:doctor:073','DEMO-WARD-073','$2a$10$yX9stcT5QayOCn7Yu3oVU.s.G3kzcfcRrXo7UkSTWGP5vX9tLtfbK'),
  (8,'doctor','Dr. Demo Doctor H08 074','doctor.h08.074@govcare.test','GCD-H08-DOC-074','govcare-demo-network-v1:h08:doctor:074','DEMO-WARD-074','$2a$10$SySUXhRplFHFjq/7cxYsK.4whtSgtCcPjrhm9JUgP9qpp0yFB5FBm'),
  (8,'doctor','Dr. Demo Doctor H08 075','doctor.h08.075@govcare.test','GCD-H08-DOC-075','govcare-demo-network-v1:h08:doctor:075','DEMO-WARD-075','$2a$10$h9N5H3zId7SyufECk2PsR.uhYYzFcF8OAURtyvkj6BZnek8Yqpfbe'),
  (8,'doctor','Dr. Demo Doctor H08 076','doctor.h08.076@govcare.test','GCD-H08-DOC-076','govcare-demo-network-v1:h08:doctor:076','DEMO-WARD-076','$2a$10$Bp7cf8ZU6N33VXAsxPuHJuBJ2CPggUwWpFYyMtw0EcUh91fHGfr6m'),
  (8,'doctor','Dr. Demo Doctor H08 077','doctor.h08.077@govcare.test','GCD-H08-DOC-077','govcare-demo-network-v1:h08:doctor:077','DEMO-WARD-077','$2a$10$uJNvMGP2MWb/QMwbG7PJh.XcPIRicTN97TUvlgaVWGzgVPYbYR9we'),
  (8,'doctor','Dr. Demo Doctor H08 078','doctor.h08.078@govcare.test','GCD-H08-DOC-078','govcare-demo-network-v1:h08:doctor:078','DEMO-WARD-078','$2a$10$hLYjpm12Fk2GLzIRCAx1Meg0oIIU33H1c9ik1vU1myC/wqrMf/Uqe'),
  (8,'doctor','Dr. Demo Doctor H08 079','doctor.h08.079@govcare.test','GCD-H08-DOC-079','govcare-demo-network-v1:h08:doctor:079','DEMO-WARD-079','$2a$10$dl3wO6QUq0lro.LVu0jjm./DRdmm8fpE0bEZmIY6WhQgHy8e.FnCq'),
  (8,'doctor','Dr. Demo Doctor H08 080','doctor.h08.080@govcare.test','GCD-H08-DOC-080','govcare-demo-network-v1:h08:doctor:080','DEMO-WARD-080','$2a$10$7TZJyi6BXfqozNYqDTlVWufv0s3923DeuPdtTCR29TzcmPGja5F0W'),
  (8,'doctor','Dr. Demo Doctor H08 081','doctor.h08.081@govcare.test','GCD-H08-DOC-081','govcare-demo-network-v1:h08:doctor:081','DEMO-WARD-081','$2a$10$M87gTZ.yetcHunKrrHJ7VO2rkQCzlub1dmHhV19uFQgLDdvXwF0XC'),
  (8,'doctor','Dr. Demo Doctor H08 082','doctor.h08.082@govcare.test','GCD-H08-DOC-082','govcare-demo-network-v1:h08:doctor:082','DEMO-WARD-082','$2a$10$woYhkhcBNMdBzc3bvDBpn.H5nM7br75xlbpgmCEF/g9Atx/takA3u'),
  (8,'doctor','Dr. Demo Doctor H08 083','doctor.h08.083@govcare.test','GCD-H08-DOC-083','govcare-demo-network-v1:h08:doctor:083','DEMO-WARD-083','$2a$10$Q6.JbuSxV1DPS86gdyDjw.M1N51FlUTcHS2l0GwuEcUPhwldrnihm'),
  (8,'doctor','Dr. Demo Doctor H08 084','doctor.h08.084@govcare.test','GCD-H08-DOC-084','govcare-demo-network-v1:h08:doctor:084','DEMO-WARD-084','$2a$10$Ri47KMHlQkUNB0x0YobZg.uQIxe14Hp12hOBvNTNpMXrn4bFEESzq'),
  (8,'doctor','Dr. Demo Doctor H08 085','doctor.h08.085@govcare.test','GCD-H08-DOC-085','govcare-demo-network-v1:h08:doctor:085','DEMO-WARD-085','$2a$10$7lbAsOixgcoXnVA16qu69eKkmn/jK/VyJkXHy0If0vYwn2v9E2vBy'),
  (8,'doctor','Dr. Demo Doctor H08 086','doctor.h08.086@govcare.test','GCD-H08-DOC-086','govcare-demo-network-v1:h08:doctor:086','DEMO-WARD-086','$2a$10$a2WDstVeXRFHcQjVWqG84uiIfaPUcwT4tEjUJLNcKRr3ZCXOJleFW'),
  (8,'doctor','Dr. Demo Doctor H08 087','doctor.h08.087@govcare.test','GCD-H08-DOC-087','govcare-demo-network-v1:h08:doctor:087','DEMO-WARD-087','$2a$10$K.FFQM9zyXGsQPCezU0HNe0m8FGSsIi1IP0TNgjU9AxokyiYJLIRm'),
  (8,'doctor','Dr. Demo Doctor H08 088','doctor.h08.088@govcare.test','GCD-H08-DOC-088','govcare-demo-network-v1:h08:doctor:088','DEMO-WARD-088','$2a$10$G6h.OEzS5jNayZOrU2xyuOrUWKs2V...cU0BJQy8hnQtN9N7s6Hw6'),
  (8,'doctor','Dr. Demo Doctor H08 089','doctor.h08.089@govcare.test','GCD-H08-DOC-089','govcare-demo-network-v1:h08:doctor:089','DEMO-WARD-089','$2a$10$DKOqNOAIrHNOE.rxIja0L.JSy5A1L5kfFEI2SUhuUwCNzMrThHxxW'),
  (8,'doctor','Dr. Demo Doctor H08 090','doctor.h08.090@govcare.test','GCD-H08-DOC-090','govcare-demo-network-v1:h08:doctor:090','DEMO-WARD-090','$2a$10$L1bYOiOI19oGPJtNfQN//eQi5a4UIM.5vTE1aruQBskYXXfTpG/6.'),
  (8,'doctor','Dr. Demo Doctor H08 091','doctor.h08.091@govcare.test','GCD-H08-DOC-091','govcare-demo-network-v1:h08:doctor:091','DEMO-WARD-091','$2a$10$IyTxlXL4geXMJjBLNUZWguaZUsRnr.2mm0Mm4kJJgR6Hlb.fDC1.G'),
  (8,'doctor','Dr. Demo Doctor H08 092','doctor.h08.092@govcare.test','GCD-H08-DOC-092','govcare-demo-network-v1:h08:doctor:092','DEMO-WARD-092','$2a$10$yGHykA1zoX96fJvp2zjWhepM1sSiq8hIsx.GttAwNkwK0uTcYkxYK'),
  (8,'doctor','Dr. Demo Doctor H08 093','doctor.h08.093@govcare.test','GCD-H08-DOC-093','govcare-demo-network-v1:h08:doctor:093','DEMO-WARD-093','$2a$10$6zhV6i1jgzHoU/BxxO4/cuTmNf29BJNawtul9jG/U4g/U8mn.Ag8m'),
  (8,'doctor','Dr. Demo Doctor H08 094','doctor.h08.094@govcare.test','GCD-H08-DOC-094','govcare-demo-network-v1:h08:doctor:094','DEMO-WARD-094','$2a$10$X4w0Ek0XJ4/USGs6Le/IveGu7S31CxA9TkjnhNeviC/gPaV0Oqtg.'),
  (8,'doctor','Dr. Demo Doctor H08 095','doctor.h08.095@govcare.test','GCD-H08-DOC-095','govcare-demo-network-v1:h08:doctor:095','DEMO-WARD-095','$2a$10$65QTlF1OZxmUxk0fI1o6a.Wga5JBhj620pFk6cxog/igVsKPqkiEO'),
  (8,'doctor','Dr. Demo Doctor H08 096','doctor.h08.096@govcare.test','GCD-H08-DOC-096','govcare-demo-network-v1:h08:doctor:096','DEMO-WARD-096','$2a$10$zBavj44ssP8uLW0lvKc9QuU0WdvNSHBNOVsTRSCEg4JaacIm0ZytC'),
  (8,'doctor','Dr. Demo Doctor H08 097','doctor.h08.097@govcare.test','GCD-H08-DOC-097','govcare-demo-network-v1:h08:doctor:097','DEMO-WARD-097','$2a$10$UB3FTwOHoALo4zMzD571UeDa/ul9NG8lyxwvsVxJu.GPD9o4gg936'),
  (8,'doctor','Dr. Demo Doctor H08 098','doctor.h08.098@govcare.test','GCD-H08-DOC-098','govcare-demo-network-v1:h08:doctor:098','DEMO-WARD-098','$2a$10$w2pNQuLfZz0W0VZZ9AFMeuJzRWJwX2zz31IlhzOyHwS1CNPnp0KXW'),
  (8,'doctor','Dr. Demo Doctor H08 099','doctor.h08.099@govcare.test','GCD-H08-DOC-099','govcare-demo-network-v1:h08:doctor:099','DEMO-WARD-099','$2a$10$LVoDsU8Ps07caFdEJvrVM.Kem/ZHj9fhJIEE7R1TmOJZREy4GzDGy'),
  (8,'doctor','Dr. Demo Doctor H08 100','doctor.h08.100@govcare.test','GCD-H08-DOC-100','govcare-demo-network-v1:h08:doctor:100','DEMO-WARD-100','$2a$10$egiVcP.iTO1FJQiQk/hHDei1gsSTY3ArrZE0DjeDaQIrx9m5VHg6K'),
  (8,'hospital_admin','Demo Hospital Admin H08','admin.h08@govcare.test','GCD-H08-ADMIN','govcare-demo-network-v1:h08:hospital_admin','ADMIN','$2a$10$piU1Ilvnijg8sRMAgsNtcejOcTxAHuD3/nHWL.fH0VWVGrQ6FYfxO'),
  (8,'receptionist','Demo Front Desk Officer H08','reception.h08@govcare.test','GCD-H08-RECEPTION','govcare-demo-network-v1:h08:receptionist','RECEPTION','$2a$10$3j0zT87G4CllEmf2.UURT.B5u4DCHIR8C2F0f35jzNWrtBg913jzG'),
  (8,'nurse','Demo Nurse H08','nurse.h08@govcare.test','GCD-H08-NURSE','govcare-demo-network-v1:h08:nurse','DEMO-WARD-001','$2a$10$9nUKLYjdBHDmrzD7yHjAFO27SwUDTuuaCyyyQolEsGZeagIailNWu'),
  (8,'ward_manager','Demo Ward Manager H08','wardmanager.h08@govcare.test','GCD-H08-WARDMANAGER','govcare-demo-network-v1:h08:ward_manager','DEMO-WARD-001','$2a$10$jMLbsvpdHGCpdtFKDhDE/O5FkyEwQAHsJXPbnTqzyCD6gSrfegY2S'),
  (8,'patient','Demo Patient Portal User H08','patient.h08@govcare.test','GCD-H08-PATIENT','govcare-demo-network-v1:h08:patient',null,'$2a$10$VAiiLMNX7zsJEpkeNDawWu5o4V1q74NBXnkQvuhgdnwvfmcWoJSvy'),
  (8,'guardian','Demo Guardian Portal User H08','guardian.h08@govcare.test','GCD-H08-GUARDIAN','govcare-demo-network-v1:h08:guardian',null,'$2a$10$N6LzKWbJTb2271YO64VhoOXKkPIG0clIMFHMQF/7/EPsM1Ss5kCjG'),
  (9,'doctor','Dr. Demo Doctor H09 001','doctor.h09.001@govcare.test','GCD-H09-DOC-001','govcare-demo-network-v1:h09:doctor:001','DEMO-WARD-001','$2a$10$kc04qRch3u6Jj0pwK4Dr5.nRrMDEP7aI9i6SgiSOQ5AuAFGUsehoy'),
  (9,'doctor','Dr. Demo Doctor H09 002','doctor.h09.002@govcare.test','GCD-H09-DOC-002','govcare-demo-network-v1:h09:doctor:002','DEMO-WARD-002','$2a$10$sVb1lr6NHIF4c26BgrU9/u.uAwEesOillREyo8/r5iqIaItMxDRgO'),
  (9,'doctor','Dr. Demo Doctor H09 003','doctor.h09.003@govcare.test','GCD-H09-DOC-003','govcare-demo-network-v1:h09:doctor:003','DEMO-WARD-003','$2a$10$mYs1QQ9D/h9YM4i/NBOrYemB4jh8/1C57IfQK6Qmxz7TGEcw2WLyC'),
  (9,'doctor','Dr. Demo Doctor H09 004','doctor.h09.004@govcare.test','GCD-H09-DOC-004','govcare-demo-network-v1:h09:doctor:004','DEMO-WARD-004','$2a$10$ZHLhbIgmV0PUHM8ph.0XUeDQr3Lb9KvU6z9CuI3NbbYhpNvk8CPRC'),
  (9,'doctor','Dr. Demo Doctor H09 005','doctor.h09.005@govcare.test','GCD-H09-DOC-005','govcare-demo-network-v1:h09:doctor:005','DEMO-WARD-005','$2a$10$Y1qmEF2pzQSh.rK7wLWiy.LmV0qwR8JHOwS6qyZW0W8CuhsMXqc.G'),
  (9,'doctor','Dr. Demo Doctor H09 006','doctor.h09.006@govcare.test','GCD-H09-DOC-006','govcare-demo-network-v1:h09:doctor:006','DEMO-WARD-006','$2a$10$4w9lCHWN0NwGkvq2A5bqr.LqnaUHESB8f6e8zAGWZ9w4M5GQFsP4.'),
  (9,'doctor','Dr. Demo Doctor H09 007','doctor.h09.007@govcare.test','GCD-H09-DOC-007','govcare-demo-network-v1:h09:doctor:007','DEMO-WARD-007','$2a$10$aMj2lDXuNNcUV5QBj8FWyeEhQUMukEwC6orMqp/FKZ1Z5m/2DcZO.'),
  (9,'doctor','Dr. Demo Doctor H09 008','doctor.h09.008@govcare.test','GCD-H09-DOC-008','govcare-demo-network-v1:h09:doctor:008','DEMO-WARD-008','$2a$10$XEVhmaiYAH3QtwyOLwFSteKdqWJE.qNctpk/mmgXsct9e7i5XGNvq'),
  (9,'doctor','Dr. Demo Doctor H09 009','doctor.h09.009@govcare.test','GCD-H09-DOC-009','govcare-demo-network-v1:h09:doctor:009','DEMO-WARD-009','$2a$10$Py/BIYXCBmdzrPt4BFEWme/omFDhcxpBKofkjZKUM5Dq1NArB3ZgS'),
  (9,'doctor','Dr. Demo Doctor H09 010','doctor.h09.010@govcare.test','GCD-H09-DOC-010','govcare-demo-network-v1:h09:doctor:010','DEMO-WARD-010','$2a$10$UVXxUXqfTiaKHnDkOx7FQeY1uCS31zgeBGGZ9KtgWKoZeOP08Zkba'),
  (9,'doctor','Dr. Demo Doctor H09 011','doctor.h09.011@govcare.test','GCD-H09-DOC-011','govcare-demo-network-v1:h09:doctor:011','DEMO-WARD-011','$2a$10$rGlqyE/GI0c7HUGYV4XPTORKfLYTVYTFwVq4nMo2V/RFsMgHVAbU6'),
  (9,'doctor','Dr. Demo Doctor H09 012','doctor.h09.012@govcare.test','GCD-H09-DOC-012','govcare-demo-network-v1:h09:doctor:012','DEMO-WARD-012','$2a$10$GEeLXb7Z9entlOhLxsk/quIm72aRWUjDX4Dskx3T3Vo8KU2IJJeqq'),
  (9,'doctor','Dr. Demo Doctor H09 013','doctor.h09.013@govcare.test','GCD-H09-DOC-013','govcare-demo-network-v1:h09:doctor:013','DEMO-WARD-013','$2a$10$1rHYRIQH2W2TRLIVJabuveHZXYXz9qJNwj/dkBBniI/kZNiD5vvw.'),
  (9,'doctor','Dr. Demo Doctor H09 014','doctor.h09.014@govcare.test','GCD-H09-DOC-014','govcare-demo-network-v1:h09:doctor:014','DEMO-WARD-014','$2a$10$O97Ps7jg0aw2Z7u3mE7N4efXsYgEavg.9mk.OeD/4lBytAhzQ6s/m'),
  (9,'doctor','Dr. Demo Doctor H09 015','doctor.h09.015@govcare.test','GCD-H09-DOC-015','govcare-demo-network-v1:h09:doctor:015','DEMO-WARD-015','$2a$10$kxA/ZHMDJbvii24FLzO7QeN7p1nyFW3ngGwDTU9Dt7nKudstwwV0u'),
  (9,'doctor','Dr. Demo Doctor H09 016','doctor.h09.016@govcare.test','GCD-H09-DOC-016','govcare-demo-network-v1:h09:doctor:016','DEMO-WARD-016','$2a$10$RJdRRfSTuAMfwf46dI42suNvmLFaMmOTnp1DcLJS/DFKcU6dgk636'),
  (9,'doctor','Dr. Demo Doctor H09 017','doctor.h09.017@govcare.test','GCD-H09-DOC-017','govcare-demo-network-v1:h09:doctor:017','DEMO-WARD-017','$2a$10$GxH9bHhuPuKFJlZgbga/Xu2ZeO/Xs4VogLywR4bpRuqNUJ1EEu2S2'),
  (9,'doctor','Dr. Demo Doctor H09 018','doctor.h09.018@govcare.test','GCD-H09-DOC-018','govcare-demo-network-v1:h09:doctor:018','DEMO-WARD-018','$2a$10$flZaZsgbYwj6DAUOtTgcWOOsUkZHWJRXls7LJD0cZmFs.xqATsawe'),
  (9,'doctor','Dr. Demo Doctor H09 019','doctor.h09.019@govcare.test','GCD-H09-DOC-019','govcare-demo-network-v1:h09:doctor:019','DEMO-WARD-019','$2a$10$jg6aA9545XxE49wKFMqnh.k.oOHTWzk4OzXw/Ay6rZ6nNpc9JIqAS'),
  (9,'doctor','Dr. Demo Doctor H09 020','doctor.h09.020@govcare.test','GCD-H09-DOC-020','govcare-demo-network-v1:h09:doctor:020','DEMO-WARD-020','$2a$10$ao7uJ2IXLsXtw7DLLgVC2.wHQTYiHmD1t4WWjLPCM50h/JPHQOpHe'),
  (9,'doctor','Dr. Demo Doctor H09 021','doctor.h09.021@govcare.test','GCD-H09-DOC-021','govcare-demo-network-v1:h09:doctor:021','DEMO-WARD-021','$2a$10$xmeJT.Jn3nT4uFbZuThA6.oueiPt7ycbDtEsXRAVo/Y2s86gBgnT6'),
  (9,'doctor','Dr. Demo Doctor H09 022','doctor.h09.022@govcare.test','GCD-H09-DOC-022','govcare-demo-network-v1:h09:doctor:022','DEMO-WARD-022','$2a$10$N1qm.pKMtSHeYcx.fhxJlubWR2vZ01T2ak5oDSFj8AXYp8gGs1miG'),
  (9,'doctor','Dr. Demo Doctor H09 023','doctor.h09.023@govcare.test','GCD-H09-DOC-023','govcare-demo-network-v1:h09:doctor:023','DEMO-WARD-023','$2a$10$IbX5c.KqXf1wtoAkgjtchuzyHXFTkI60IsyyI4FgsF.sb7yMM1oWW'),
  (9,'doctor','Dr. Demo Doctor H09 024','doctor.h09.024@govcare.test','GCD-H09-DOC-024','govcare-demo-network-v1:h09:doctor:024','DEMO-WARD-024','$2a$10$4HAbZxHefruwRPJiiaG2ouqfQ5TZyZ12pedd6.IzqztZZmIcpI7ky'),
  (9,'doctor','Dr. Demo Doctor H09 025','doctor.h09.025@govcare.test','GCD-H09-DOC-025','govcare-demo-network-v1:h09:doctor:025','DEMO-WARD-025','$2a$10$Tz5n5Y7XG1rN7f/lAFZK7.Uog/WVrgUTWjxcvsCG7ITNhStG5b4Uy'),
  (9,'doctor','Dr. Demo Doctor H09 026','doctor.h09.026@govcare.test','GCD-H09-DOC-026','govcare-demo-network-v1:h09:doctor:026','DEMO-WARD-026','$2a$10$G.plGmleosyaPCqyfxASBe7MP2IouQzr8YEi6J9J4JA/bFfekSJCa'),
  (9,'doctor','Dr. Demo Doctor H09 027','doctor.h09.027@govcare.test','GCD-H09-DOC-027','govcare-demo-network-v1:h09:doctor:027','DEMO-WARD-027','$2a$10$mXe9i/nC6AaccCPNbjscmuAmUFCVdL25Gh0Gk1KJU3BHiZK74Z.Gi'),
  (9,'doctor','Dr. Demo Doctor H09 028','doctor.h09.028@govcare.test','GCD-H09-DOC-028','govcare-demo-network-v1:h09:doctor:028','DEMO-WARD-028','$2a$10$C7OpsBepk4gSk4ZKXtbW/udUbgFPRFG0b6Fu1SNEy9i.LK9CRzC5y'),
  (9,'doctor','Dr. Demo Doctor H09 029','doctor.h09.029@govcare.test','GCD-H09-DOC-029','govcare-demo-network-v1:h09:doctor:029','DEMO-WARD-029','$2a$10$8Il6aM8/9zEkC6.SdyDsGOK73WkQhWKbXiLvmN23ApOqp69lXcrT.'),
  (9,'doctor','Dr. Demo Doctor H09 030','doctor.h09.030@govcare.test','GCD-H09-DOC-030','govcare-demo-network-v1:h09:doctor:030','DEMO-WARD-030','$2a$10$e.7MBKEGiKSCEFgAsRz4i.4hgWvOKpjSlmLMqFTVjRX9kCXNAyCX6'),
  (9,'doctor','Dr. Demo Doctor H09 031','doctor.h09.031@govcare.test','GCD-H09-DOC-031','govcare-demo-network-v1:h09:doctor:031','DEMO-WARD-031','$2a$10$GF.gVnjb9oh7PS5CY.uxa.Df.kARWzZFBVLjhjW1bnit1HkeO.E4u'),
  (9,'doctor','Dr. Demo Doctor H09 032','doctor.h09.032@govcare.test','GCD-H09-DOC-032','govcare-demo-network-v1:h09:doctor:032','DEMO-WARD-032','$2a$10$5CNGD/hUeQgjcA1q6nQ/mOoywOW55uPdIqOBFCxSZR6zPGtbRPKty'),
  (9,'doctor','Dr. Demo Doctor H09 033','doctor.h09.033@govcare.test','GCD-H09-DOC-033','govcare-demo-network-v1:h09:doctor:033','DEMO-WARD-033','$2a$10$G/kQJsvYtznZeBPrMUKAaOxUmE4N3IY7URX4dirh2TNndkIvvE0Uy'),
  (9,'doctor','Dr. Demo Doctor H09 034','doctor.h09.034@govcare.test','GCD-H09-DOC-034','govcare-demo-network-v1:h09:doctor:034','DEMO-WARD-034','$2a$10$EBf96IH22txcJjOQyGDonu.Kzhar45z3MNunAfmjFE2ga2XPmckuW'),
  (9,'doctor','Dr. Demo Doctor H09 035','doctor.h09.035@govcare.test','GCD-H09-DOC-035','govcare-demo-network-v1:h09:doctor:035','DEMO-WARD-035','$2a$10$F4Qhxf.//tnBptEFiIk7befRc46pOaX8IN2vFsT8Q/3NCGlRWlWoe'),
  (9,'doctor','Dr. Demo Doctor H09 036','doctor.h09.036@govcare.test','GCD-H09-DOC-036','govcare-demo-network-v1:h09:doctor:036','DEMO-WARD-036','$2a$10$iarPPss2Qm82odureuIazORchwpCdr4JqWhL5EUV3EK6qha/9mOYa'),
  (9,'doctor','Dr. Demo Doctor H09 037','doctor.h09.037@govcare.test','GCD-H09-DOC-037','govcare-demo-network-v1:h09:doctor:037','DEMO-WARD-037','$2a$10$p1L.o2KTJvo1QNeTZnY4OOrHplxd8BqgfQwy5Sseo77zP08Hjz8yW'),
  (9,'doctor','Dr. Demo Doctor H09 038','doctor.h09.038@govcare.test','GCD-H09-DOC-038','govcare-demo-network-v1:h09:doctor:038','DEMO-WARD-038','$2a$10$qS0mguGcfSqyF6h/E2xnhOJVqvAkeTHOQmZlVQdny2sX6KXRqFBhq'),
  (9,'doctor','Dr. Demo Doctor H09 039','doctor.h09.039@govcare.test','GCD-H09-DOC-039','govcare-demo-network-v1:h09:doctor:039','DEMO-WARD-039','$2a$10$mMArX7KJDjQKwyCBjtfko.gqsFheE9XeBevm3UoEHCUUvFXpp8O5S'),
  (9,'doctor','Dr. Demo Doctor H09 040','doctor.h09.040@govcare.test','GCD-H09-DOC-040','govcare-demo-network-v1:h09:doctor:040','DEMO-WARD-040','$2a$10$ffN7/ksatYEwQON7ZORJwu2ceqcDcz0bqBx.wPwFaCqry5cx2O.5u'),
  (9,'doctor','Dr. Demo Doctor H09 041','doctor.h09.041@govcare.test','GCD-H09-DOC-041','govcare-demo-network-v1:h09:doctor:041','DEMO-WARD-041','$2a$10$bzrFtxm/4yPyi9xQa76NoOviDVNo/MMo2tAMZVws6qFoGJ17nnMZ.'),
  (9,'doctor','Dr. Demo Doctor H09 042','doctor.h09.042@govcare.test','GCD-H09-DOC-042','govcare-demo-network-v1:h09:doctor:042','DEMO-WARD-042','$2a$10$cuZOMzJuub9fbyHpXxjnWeAQMr7Pt7C4d7nh35UAzWJrk2ayKNgei'),
  (9,'doctor','Dr. Demo Doctor H09 043','doctor.h09.043@govcare.test','GCD-H09-DOC-043','govcare-demo-network-v1:h09:doctor:043','DEMO-WARD-043','$2a$10$OkMwTYNZz1Hx6OcduReQbeg62ypXt/I/m80LNtcUvI1e2kL5CWDYi'),
  (9,'doctor','Dr. Demo Doctor H09 044','doctor.h09.044@govcare.test','GCD-H09-DOC-044','govcare-demo-network-v1:h09:doctor:044','DEMO-WARD-044','$2a$10$wzye/gxQMZVvseUuanJ9PejQijb95whtsdinDtsLPHfNM4yn.dq9S'),
  (9,'doctor','Dr. Demo Doctor H09 045','doctor.h09.045@govcare.test','GCD-H09-DOC-045','govcare-demo-network-v1:h09:doctor:045','DEMO-WARD-045','$2a$10$5HAipE4zn4NXYExnphbCz.WGYbXTg1Koz0WJ4qbku7b10d2q/zmRq'),
  (9,'doctor','Dr. Demo Doctor H09 046','doctor.h09.046@govcare.test','GCD-H09-DOC-046','govcare-demo-network-v1:h09:doctor:046','DEMO-WARD-046','$2a$10$RXmjfPm.Pf02W3NX5h1H8uoUxMFX0y0HHKyT/K0qIhpSfYhdcQTG6'),
  (9,'doctor','Dr. Demo Doctor H09 047','doctor.h09.047@govcare.test','GCD-H09-DOC-047','govcare-demo-network-v1:h09:doctor:047','DEMO-WARD-047','$2a$10$P1IEpgqkWQGqfg4xCZlVS.8WQ97x3wr8zXUwTK1wrMzk9sOVx14S.'),
  (9,'doctor','Dr. Demo Doctor H09 048','doctor.h09.048@govcare.test','GCD-H09-DOC-048','govcare-demo-network-v1:h09:doctor:048','DEMO-WARD-048','$2a$10$TrmGNssJsQWHLSfRow4qmeelGmURL1bFixq1x.b.SvTZ1V7CUFg5.'),
  (9,'doctor','Dr. Demo Doctor H09 049','doctor.h09.049@govcare.test','GCD-H09-DOC-049','govcare-demo-network-v1:h09:doctor:049','DEMO-WARD-049','$2a$10$L7YKzXOcjvVT/ubLp.DYYebQWvBYM8hu/Z2ULL02QNm4x/c4Myl.W'),
  (9,'doctor','Dr. Demo Doctor H09 050','doctor.h09.050@govcare.test','GCD-H09-DOC-050','govcare-demo-network-v1:h09:doctor:050','DEMO-WARD-050','$2a$10$CJeMcIRxQ0FhjbPAR33/xOX.q2Sk9emglXTSAqGZVaZeHaaM4vrVK'),
  (9,'doctor','Dr. Demo Doctor H09 051','doctor.h09.051@govcare.test','GCD-H09-DOC-051','govcare-demo-network-v1:h09:doctor:051','DEMO-WARD-051','$2a$10$QkDv/vfvpQWga9v3E416a.0v/sZan1qFnXwOd.zyFZYfe8HZFNUbS'),
  (9,'doctor','Dr. Demo Doctor H09 052','doctor.h09.052@govcare.test','GCD-H09-DOC-052','govcare-demo-network-v1:h09:doctor:052','DEMO-WARD-052','$2a$10$ehi5uIGd7WWloFobbtDAyOJtKJ62L11tfSshBn3pw3zyqOqt81Twy'),
  (9,'doctor','Dr. Demo Doctor H09 053','doctor.h09.053@govcare.test','GCD-H09-DOC-053','govcare-demo-network-v1:h09:doctor:053','DEMO-WARD-053','$2a$10$unmfxXGmPGi8D/9zbtjV8O4Opz5d9Aj81IhEpXYR.ghK/TecR9rLW'),
  (9,'doctor','Dr. Demo Doctor H09 054','doctor.h09.054@govcare.test','GCD-H09-DOC-054','govcare-demo-network-v1:h09:doctor:054','DEMO-WARD-054','$2a$10$QqrZOFnw6tuDma5qCk5NBeYSW0AvuGE.WPI2FdRlnt709Jij4hzW2'),
  (9,'doctor','Dr. Demo Doctor H09 055','doctor.h09.055@govcare.test','GCD-H09-DOC-055','govcare-demo-network-v1:h09:doctor:055','DEMO-WARD-055','$2a$10$7sCaEXBm9/16jehqIzYk/.yUlAh5tjP11pt.XJhDBOhSmo9tisE5y'),
  (9,'doctor','Dr. Demo Doctor H09 056','doctor.h09.056@govcare.test','GCD-H09-DOC-056','govcare-demo-network-v1:h09:doctor:056','DEMO-WARD-056','$2a$10$aTolcup05c64XP5tOWvcNOGtqxaF7nHd35Pryam69tMd8Aps7f7p6'),
  (9,'doctor','Dr. Demo Doctor H09 057','doctor.h09.057@govcare.test','GCD-H09-DOC-057','govcare-demo-network-v1:h09:doctor:057','DEMO-WARD-057','$2a$10$Ogbr.SrRzH4Io597DBLMiOfV8ca0eKsDqzTUYqbiFjouf.WsZXLT.'),
  (9,'doctor','Dr. Demo Doctor H09 058','doctor.h09.058@govcare.test','GCD-H09-DOC-058','govcare-demo-network-v1:h09:doctor:058','DEMO-WARD-058','$2a$10$EK69y3Uh6o4vYH7Yo5FHUuieqgNrfhiewG7FWDWMz1CTLWzPHrXZW'),
  (9,'doctor','Dr. Demo Doctor H09 059','doctor.h09.059@govcare.test','GCD-H09-DOC-059','govcare-demo-network-v1:h09:doctor:059','DEMO-WARD-059','$2a$10$4SbRQgy9biJaNuQC5.YhtuAu4emHPaKxa4Babd4.c4lKDGu6wbuEW'),
  (9,'doctor','Dr. Demo Doctor H09 060','doctor.h09.060@govcare.test','GCD-H09-DOC-060','govcare-demo-network-v1:h09:doctor:060','DEMO-WARD-060','$2a$10$f2HqOGj12DJH0up6JhT9auPxurQmZkP0d71YaecaVrfrjqyYBvtRK'),
  (9,'doctor','Dr. Demo Doctor H09 061','doctor.h09.061@govcare.test','GCD-H09-DOC-061','govcare-demo-network-v1:h09:doctor:061','DEMO-WARD-061','$2a$10$AngCTVhB8mz0NkSmtzrv.uN4T884AGt0efw/q9V.1b0czVmOhnl3O'),
  (9,'doctor','Dr. Demo Doctor H09 062','doctor.h09.062@govcare.test','GCD-H09-DOC-062','govcare-demo-network-v1:h09:doctor:062','DEMO-WARD-062','$2a$10$1wZnw8SBBVgc5gIIEopF8O/RmVVGYLpIVOx6E.xPyAuNm7AzchKLK'),
  (9,'doctor','Dr. Demo Doctor H09 063','doctor.h09.063@govcare.test','GCD-H09-DOC-063','govcare-demo-network-v1:h09:doctor:063','DEMO-WARD-063','$2a$10$sQ3PLg8Oc75uGMZoPlWbCOJXNtgKiQFsZKXBNltZCO3XhabjzqNPy'),
  (9,'doctor','Dr. Demo Doctor H09 064','doctor.h09.064@govcare.test','GCD-H09-DOC-064','govcare-demo-network-v1:h09:doctor:064','DEMO-WARD-064','$2a$10$DdBw.laXkiilYOW29IjHreGZ7d3S6tu6Vtmt89NqC0WIcfVYab22S'),
  (9,'doctor','Dr. Demo Doctor H09 065','doctor.h09.065@govcare.test','GCD-H09-DOC-065','govcare-demo-network-v1:h09:doctor:065','DEMO-WARD-065','$2a$10$.fsbi0QPQ7IBA55husZAo.rj/SMNPVLA/IriAkAkUWLmQAT2DUcfG'),
  (9,'doctor','Dr. Demo Doctor H09 066','doctor.h09.066@govcare.test','GCD-H09-DOC-066','govcare-demo-network-v1:h09:doctor:066','DEMO-WARD-066','$2a$10$z4XVcFFfCXPv.k9RUH420upgQD/2.gra6VGL8hYITw03IG1nPFeHG'),
  (9,'doctor','Dr. Demo Doctor H09 067','doctor.h09.067@govcare.test','GCD-H09-DOC-067','govcare-demo-network-v1:h09:doctor:067','DEMO-WARD-067','$2a$10$eHJ09k3DVUqt8lVRVSIRQuNJmzAc1YfYuU5FKeuHepbMQGmB/j5Xi'),
  (9,'doctor','Dr. Demo Doctor H09 068','doctor.h09.068@govcare.test','GCD-H09-DOC-068','govcare-demo-network-v1:h09:doctor:068','DEMO-WARD-068','$2a$10$PkmRbbbIlJZBLaX16k3bDu//iSDX4ETXL50xvlt0nFEKQPh09JdD2'),
  (9,'doctor','Dr. Demo Doctor H09 069','doctor.h09.069@govcare.test','GCD-H09-DOC-069','govcare-demo-network-v1:h09:doctor:069','DEMO-WARD-069','$2a$10$QMepu4SutYgvSAVbYRtV/e5EhnD7me2QtgHcobP65Mv7Oqn8x7Ip2'),
  (9,'doctor','Dr. Demo Doctor H09 070','doctor.h09.070@govcare.test','GCD-H09-DOC-070','govcare-demo-network-v1:h09:doctor:070','DEMO-WARD-070','$2a$10$z.nT68QjbLF4xyF.50poleMn8OwjarfdOOAwbCK7c4c5ZugLHq61q'),
  (9,'doctor','Dr. Demo Doctor H09 071','doctor.h09.071@govcare.test','GCD-H09-DOC-071','govcare-demo-network-v1:h09:doctor:071','DEMO-WARD-071','$2a$10$QLtoeo6FCL1hSJc.v0TKIeSgIRR2YAt56bCXKrchYNvI6eT7E9USC'),
  (9,'doctor','Dr. Demo Doctor H09 072','doctor.h09.072@govcare.test','GCD-H09-DOC-072','govcare-demo-network-v1:h09:doctor:072','DEMO-WARD-072','$2a$10$jAVjzRCVGWMn7tgd3ItzuuMBS3jzCCiCE3PO4RD1iphLx63Oo3/Tm'),
  (9,'doctor','Dr. Demo Doctor H09 073','doctor.h09.073@govcare.test','GCD-H09-DOC-073','govcare-demo-network-v1:h09:doctor:073','DEMO-WARD-073','$2a$10$ua3l5fAUjFxKUE/GncOso.sX1BD9uLR54Cpt4ebNRQP.CEZPYwDjC'),
  (9,'doctor','Dr. Demo Doctor H09 074','doctor.h09.074@govcare.test','GCD-H09-DOC-074','govcare-demo-network-v1:h09:doctor:074','DEMO-WARD-074','$2a$10$CUp0m.QtPU9/WNHRj86.WeDIgVuAJbPGU5G9b.ltv/buahleBBrby'),
  (9,'doctor','Dr. Demo Doctor H09 075','doctor.h09.075@govcare.test','GCD-H09-DOC-075','govcare-demo-network-v1:h09:doctor:075','DEMO-WARD-075','$2a$10$RMa3WJL6ytqoAFfo/CvLuOHpL3wdxBI4gsKZ9O0NH9zcgtDoUaU5O'),
  (9,'doctor','Dr. Demo Doctor H09 076','doctor.h09.076@govcare.test','GCD-H09-DOC-076','govcare-demo-network-v1:h09:doctor:076','DEMO-WARD-076','$2a$10$.HG2FRp3HY2yUVKj1X0nZOB47jfiQu6xNEu4wQ0SRvRBGpdMYHRXG'),
  (9,'doctor','Dr. Demo Doctor H09 077','doctor.h09.077@govcare.test','GCD-H09-DOC-077','govcare-demo-network-v1:h09:doctor:077','DEMO-WARD-077','$2a$10$11/d1rtJFbRrMdwrukCQX.0BiLpmfFJH3DAZ2baNcNQPuq3UbBjZa'),
  (9,'doctor','Dr. Demo Doctor H09 078','doctor.h09.078@govcare.test','GCD-H09-DOC-078','govcare-demo-network-v1:h09:doctor:078','DEMO-WARD-078','$2a$10$mMGlXnb.3egJL/HV7w5ACOSWSKHhZojYiuwa5UyCVpxXyQCGdaQE6'),
  (9,'doctor','Dr. Demo Doctor H09 079','doctor.h09.079@govcare.test','GCD-H09-DOC-079','govcare-demo-network-v1:h09:doctor:079','DEMO-WARD-079','$2a$10$T7qwr9tYXuR4NPygc/ALueJh53WAAcs9polFEaHC5dVk3ZbIk63c2'),
  (9,'doctor','Dr. Demo Doctor H09 080','doctor.h09.080@govcare.test','GCD-H09-DOC-080','govcare-demo-network-v1:h09:doctor:080','DEMO-WARD-080','$2a$10$69PnnuVx4qGJ6ciMzCTlouxT.lJJgtsJgbXgjuYOC/1k7pritkNIG'),
  (9,'doctor','Dr. Demo Doctor H09 081','doctor.h09.081@govcare.test','GCD-H09-DOC-081','govcare-demo-network-v1:h09:doctor:081','DEMO-WARD-081','$2a$10$xygkrFxCOkhbIf6XV0wU6uf.14kdi8R3/N9XRxtymUIizog4FUd2y'),
  (9,'doctor','Dr. Demo Doctor H09 082','doctor.h09.082@govcare.test','GCD-H09-DOC-082','govcare-demo-network-v1:h09:doctor:082','DEMO-WARD-082','$2a$10$yW7BTH6eANbbXgiuu4eCQOo05uHP3Hc99PRDacvX/K.icchdWXHii'),
  (9,'doctor','Dr. Demo Doctor H09 083','doctor.h09.083@govcare.test','GCD-H09-DOC-083','govcare-demo-network-v1:h09:doctor:083','DEMO-WARD-083','$2a$10$osZDPF67EUje1zcFzFWb1Oy8FTq5BGt50BOkBTOwgRePPISkqDJaK'),
  (9,'doctor','Dr. Demo Doctor H09 084','doctor.h09.084@govcare.test','GCD-H09-DOC-084','govcare-demo-network-v1:h09:doctor:084','DEMO-WARD-084','$2a$10$qJ4uWG5zqtmmuirvLJbJ3eFzlZtX5tajDRiQuU8A3jYgD6HDxLROi'),
  (9,'doctor','Dr. Demo Doctor H09 085','doctor.h09.085@govcare.test','GCD-H09-DOC-085','govcare-demo-network-v1:h09:doctor:085','DEMO-WARD-085','$2a$10$rrbM4ZeFeJN7fWcw5OdRq.0Vavl/a31LgJXYC7H823SPpinUmm47u'),
  (9,'doctor','Dr. Demo Doctor H09 086','doctor.h09.086@govcare.test','GCD-H09-DOC-086','govcare-demo-network-v1:h09:doctor:086','DEMO-WARD-086','$2a$10$7YbUH0EthGO70jHsbI88guH2zSeuuwRnJxl6hHfYmi5V60pNMs6e2'),
  (9,'doctor','Dr. Demo Doctor H09 087','doctor.h09.087@govcare.test','GCD-H09-DOC-087','govcare-demo-network-v1:h09:doctor:087','DEMO-WARD-087','$2a$10$d.AwPB4jbVs1ynGWHnpwG.hSvZU7X/9pmHLJrS7AD77Bo0xdm4FEy'),
  (9,'doctor','Dr. Demo Doctor H09 088','doctor.h09.088@govcare.test','GCD-H09-DOC-088','govcare-demo-network-v1:h09:doctor:088','DEMO-WARD-088','$2a$10$dL5mNrkFvSj5pvxjP5vrS.v1qlIkX65sXV450xrzPcz.Y.rlnC6LS'),
  (9,'doctor','Dr. Demo Doctor H09 089','doctor.h09.089@govcare.test','GCD-H09-DOC-089','govcare-demo-network-v1:h09:doctor:089','DEMO-WARD-089','$2a$10$V8uMbqhBmJqozWPYTzVaxOU1wg8jt6HlBCvnhGQSq1rcLtWizcO/S'),
  (9,'doctor','Dr. Demo Doctor H09 090','doctor.h09.090@govcare.test','GCD-H09-DOC-090','govcare-demo-network-v1:h09:doctor:090','DEMO-WARD-090','$2a$10$JLMyF.YqEUFfuSGNnIGjr.SA9AnwIGI235pU9Z8iVlK8Je6Zlsz0S'),
  (9,'doctor','Dr. Demo Doctor H09 091','doctor.h09.091@govcare.test','GCD-H09-DOC-091','govcare-demo-network-v1:h09:doctor:091','DEMO-WARD-091','$2a$10$6okiERFj1/9kPklrDDOmf.1HZwCh4YvAPfZzbiPT.SgfjwB9gEMJ2'),
  (9,'doctor','Dr. Demo Doctor H09 092','doctor.h09.092@govcare.test','GCD-H09-DOC-092','govcare-demo-network-v1:h09:doctor:092','DEMO-WARD-092','$2a$10$OmjLAulKk2EExMA5YU6mKOz2xckF/piDqy3gCaZZFP8ZQvzZcStmy'),
  (9,'doctor','Dr. Demo Doctor H09 093','doctor.h09.093@govcare.test','GCD-H09-DOC-093','govcare-demo-network-v1:h09:doctor:093','DEMO-WARD-093','$2a$10$wgod7k/ZUsJcWzeEZTqg3uvJGRetuuz6xJUlfQK7WPOPeU2MWmzbW'),
  (9,'doctor','Dr. Demo Doctor H09 094','doctor.h09.094@govcare.test','GCD-H09-DOC-094','govcare-demo-network-v1:h09:doctor:094','DEMO-WARD-094','$2a$10$n8gkUHx6BjRZBvrVa.WdB./31Gv8hvQ7SrDjlg0hFDSKVXIMzMp6u'),
  (9,'doctor','Dr. Demo Doctor H09 095','doctor.h09.095@govcare.test','GCD-H09-DOC-095','govcare-demo-network-v1:h09:doctor:095','DEMO-WARD-095','$2a$10$Q3z0kh1tGjg8XqU95Sbj0eWgLQ5svxJXey.NuJ5uUohvcj1Yt4xAy'),
  (9,'doctor','Dr. Demo Doctor H09 096','doctor.h09.096@govcare.test','GCD-H09-DOC-096','govcare-demo-network-v1:h09:doctor:096','DEMO-WARD-096','$2a$10$Jc3G036YcRPTO.yzRDu.v.MyIhMSQ3YRXW.v7vBfkt1Ly5NlYzdsq'),
  (9,'doctor','Dr. Demo Doctor H09 097','doctor.h09.097@govcare.test','GCD-H09-DOC-097','govcare-demo-network-v1:h09:doctor:097','DEMO-WARD-097','$2a$10$xk/QJos/NJKokjKLcFxzOuoB8g0BWXTPWzM0hkAWl14e27gCp//5u'),
  (9,'doctor','Dr. Demo Doctor H09 098','doctor.h09.098@govcare.test','GCD-H09-DOC-098','govcare-demo-network-v1:h09:doctor:098','DEMO-WARD-098','$2a$10$BwmR2A9FL8KFQ8J/gd..iurXfRwuj0qCt1qhPqsncrjhaNFcnDvsS'),
  (9,'doctor','Dr. Demo Doctor H09 099','doctor.h09.099@govcare.test','GCD-H09-DOC-099','govcare-demo-network-v1:h09:doctor:099','DEMO-WARD-099','$2a$10$qfiRRgc8PjtVnRnwR5h8cOV4c7iEbxQdYdEvoej4ZbeFMQuu5tFsS'),
  (9,'doctor','Dr. Demo Doctor H09 100','doctor.h09.100@govcare.test','GCD-H09-DOC-100','govcare-demo-network-v1:h09:doctor:100','DEMO-WARD-100','$2a$10$/EiZ0lw8k4J/LJEvZU2j7eTkB3DfDnAGoM.GiSGhx5i754kaH8bh2'),
  (9,'hospital_admin','Demo Hospital Admin H09','admin.h09@govcare.test','GCD-H09-ADMIN','govcare-demo-network-v1:h09:hospital_admin','ADMIN','$2a$10$Qpbjhz9B4xDCX8NsWC3YyeJCK7c17xKhLqohFWtyvFu3kpClbFP.C'),
  (9,'receptionist','Demo Front Desk Officer H09','reception.h09@govcare.test','GCD-H09-RECEPTION','govcare-demo-network-v1:h09:receptionist','RECEPTION','$2a$10$OyT3YBYvZrrPWATJFPTcieTKEZe0QUJyRqt3l0f01CSWD7c4W4uTi'),
  (9,'nurse','Demo Nurse H09','nurse.h09@govcare.test','GCD-H09-NURSE','govcare-demo-network-v1:h09:nurse','DEMO-WARD-001','$2a$10$UzqsjqvREQr2WcHxv.ZSwO7k13HoeSMzaqeV64r2ejgza1BGLcJnO'),
  (9,'ward_manager','Demo Ward Manager H09','wardmanager.h09@govcare.test','GCD-H09-WARDMANAGER','govcare-demo-network-v1:h09:ward_manager','DEMO-WARD-001','$2a$10$cxE6KjPNBxVmor8TVUOkq.TCeJ5xzEtH7c6.D0vVUpezpukbXKnIu'),
  (9,'patient','Demo Patient Portal User H09','patient.h09@govcare.test','GCD-H09-PATIENT','govcare-demo-network-v1:h09:patient',null,'$2a$10$I99wKWEba9xAks8ux7PUDuQcv10LZ8pIyChd59wmAX7N3V6TYGIy2'),
  (9,'guardian','Demo Guardian Portal User H09','guardian.h09@govcare.test','GCD-H09-GUARDIAN','govcare-demo-network-v1:h09:guardian',null,'$2a$10$WK7Gx/Bf9TdsGkiWPQ6l/OyMMJpP.Zp5FdoOPvZasNR3CKMi4iJRC'),
  (10,'doctor','Dr. Demo Doctor H10 001','doctor.h10.001@govcare.test','GCD-H10-DOC-001','govcare-demo-network-v1:h10:doctor:001','DEMO-WARD-001','$2a$10$3q5Hy3mj6u9HnhP5oAMnFu8/uKFuYIFbuLVG2zzCIKGZfP6d25HBK'),
  (10,'doctor','Dr. Demo Doctor H10 002','doctor.h10.002@govcare.test','GCD-H10-DOC-002','govcare-demo-network-v1:h10:doctor:002','DEMO-WARD-002','$2a$10$IBrrZobewTKZqY9BCuMuyeCLKaUtFAmnSV3PT2AhYelFoGr3m/EDS'),
  (10,'doctor','Dr. Demo Doctor H10 003','doctor.h10.003@govcare.test','GCD-H10-DOC-003','govcare-demo-network-v1:h10:doctor:003','DEMO-WARD-003','$2a$10$SIBkkCZpN2omdyKykuT8tOhenr6CGAkrgsPkS3cgOECeA6HQP3RIm'),
  (10,'doctor','Dr. Demo Doctor H10 004','doctor.h10.004@govcare.test','GCD-H10-DOC-004','govcare-demo-network-v1:h10:doctor:004','DEMO-WARD-004','$2a$10$Jc0sM6ly4yVBkEA4Npv7VOK1en3Mw/S3y.mXhOlH2yo3V3l.WYhRi'),
  (10,'doctor','Dr. Demo Doctor H10 005','doctor.h10.005@govcare.test','GCD-H10-DOC-005','govcare-demo-network-v1:h10:doctor:005','DEMO-WARD-005','$2a$10$LN9R2hE9X23cXj6IxMQl/e/r455bhurIp4XyhcMjtk6EDYz2nFhzW'),
  (10,'doctor','Dr. Demo Doctor H10 006','doctor.h10.006@govcare.test','GCD-H10-DOC-006','govcare-demo-network-v1:h10:doctor:006','DEMO-WARD-006','$2a$10$B4wPWj.JWmpFjtF5yxrGb.jkvAf45lfoVaTFd2t3st5SWCFbPQT1C'),
  (10,'doctor','Dr. Demo Doctor H10 007','doctor.h10.007@govcare.test','GCD-H10-DOC-007','govcare-demo-network-v1:h10:doctor:007','DEMO-WARD-007','$2a$10$cju80d8tas0WU7DmiPaNieWmA1qnmdWGXnUx.Z3EE3QYF4M0wphk2'),
  (10,'doctor','Dr. Demo Doctor H10 008','doctor.h10.008@govcare.test','GCD-H10-DOC-008','govcare-demo-network-v1:h10:doctor:008','DEMO-WARD-008','$2a$10$KRO.Vt2jMObpLgeLZJzsee.Tul9ARSyvq1CHgHHpVMRORNwJ8mRRi'),
  (10,'doctor','Dr. Demo Doctor H10 009','doctor.h10.009@govcare.test','GCD-H10-DOC-009','govcare-demo-network-v1:h10:doctor:009','DEMO-WARD-009','$2a$10$vGALd.d0OcaC8vqVeL0Wief4RBK/GXE6zMS9IR7QUhg.M.AQ5Vd62'),
  (10,'doctor','Dr. Demo Doctor H10 010','doctor.h10.010@govcare.test','GCD-H10-DOC-010','govcare-demo-network-v1:h10:doctor:010','DEMO-WARD-010','$2a$10$nyPUkWGhNGx70oakAhq4OOKH/DGT66dM6NuRegIcZOjtrHIwlPiQq'),
  (10,'doctor','Dr. Demo Doctor H10 011','doctor.h10.011@govcare.test','GCD-H10-DOC-011','govcare-demo-network-v1:h10:doctor:011','DEMO-WARD-011','$2a$10$u3LcQ/dW71NxGWdOZ0kvFuR5V.41wjFK6PNvYb6BWejDcH8wGyz/6'),
  (10,'doctor','Dr. Demo Doctor H10 012','doctor.h10.012@govcare.test','GCD-H10-DOC-012','govcare-demo-network-v1:h10:doctor:012','DEMO-WARD-012','$2a$10$L8jGTYSC20qHHgzPrHkOEebvDV5Yq.OYxMW/h5FWxbpEjOlxMU3/i'),
  (10,'doctor','Dr. Demo Doctor H10 013','doctor.h10.013@govcare.test','GCD-H10-DOC-013','govcare-demo-network-v1:h10:doctor:013','DEMO-WARD-013','$2a$10$Y.bOS/kakVLULpC5pg5c5udL4ws8uLaBdQmqvaGfehBkz25xubldO'),
  (10,'doctor','Dr. Demo Doctor H10 014','doctor.h10.014@govcare.test','GCD-H10-DOC-014','govcare-demo-network-v1:h10:doctor:014','DEMO-WARD-014','$2a$10$pSP6X3/R6D.sYOv7K.69iOKI8jCTsvIyn3edn5y8NNjPG83hyXhs.'),
  (10,'doctor','Dr. Demo Doctor H10 015','doctor.h10.015@govcare.test','GCD-H10-DOC-015','govcare-demo-network-v1:h10:doctor:015','DEMO-WARD-015','$2a$10$x9N9whzGFjR9QsNqARH07eZpsnYKuCAf/OaAku3I.4wdLD3eNf58K'),
  (10,'doctor','Dr. Demo Doctor H10 016','doctor.h10.016@govcare.test','GCD-H10-DOC-016','govcare-demo-network-v1:h10:doctor:016','DEMO-WARD-016','$2a$10$s4nzHKFIj6zeCBfln7zwIulAEagIG7dIorKb98sXcEo2.Nkb6uxxe'),
  (10,'doctor','Dr. Demo Doctor H10 017','doctor.h10.017@govcare.test','GCD-H10-DOC-017','govcare-demo-network-v1:h10:doctor:017','DEMO-WARD-017','$2a$10$RqQthgY487uAkhMA3/WXdu/eVAGjZFjjaspOyFhm8GPVqB4lFgmre'),
  (10,'doctor','Dr. Demo Doctor H10 018','doctor.h10.018@govcare.test','GCD-H10-DOC-018','govcare-demo-network-v1:h10:doctor:018','DEMO-WARD-018','$2a$10$O/IrFAj8zxp6GVHYBAwr5.y6SDGVf2rQPneMmbuvMb/xNwJB/udIy'),
  (10,'doctor','Dr. Demo Doctor H10 019','doctor.h10.019@govcare.test','GCD-H10-DOC-019','govcare-demo-network-v1:h10:doctor:019','DEMO-WARD-019','$2a$10$GakddHB9kAtsoElaCEnOm.Jjmic4DGk.9S0aYAMH9H9T.yUCh6fRu'),
  (10,'doctor','Dr. Demo Doctor H10 020','doctor.h10.020@govcare.test','GCD-H10-DOC-020','govcare-demo-network-v1:h10:doctor:020','DEMO-WARD-020','$2a$10$JzpdUQTFoH6fULHXJ1UUruEnCzzyewtfkHLmCH9/sK5e7/fSEygDe'),
  (10,'doctor','Dr. Demo Doctor H10 021','doctor.h10.021@govcare.test','GCD-H10-DOC-021','govcare-demo-network-v1:h10:doctor:021','DEMO-WARD-021','$2a$10$hc8tYDXG72Vii6Ul2G2BOOmJNkXC.wymMc.BV4tuFAK5wye99pDDC'),
  (10,'doctor','Dr. Demo Doctor H10 022','doctor.h10.022@govcare.test','GCD-H10-DOC-022','govcare-demo-network-v1:h10:doctor:022','DEMO-WARD-022','$2a$10$Hjhzgua7hHFBbx/d4TYs9OcBONlhDK0gx8QCfJoU2/oofSv/Q/gmO'),
  (10,'doctor','Dr. Demo Doctor H10 023','doctor.h10.023@govcare.test','GCD-H10-DOC-023','govcare-demo-network-v1:h10:doctor:023','DEMO-WARD-023','$2a$10$eDJW.pNoh7lC0G3sQbKp3OL2q5.8weGoYdfP0CB3bN1dV/Gc79rza'),
  (10,'doctor','Dr. Demo Doctor H10 024','doctor.h10.024@govcare.test','GCD-H10-DOC-024','govcare-demo-network-v1:h10:doctor:024','DEMO-WARD-024','$2a$10$UOXhWjN..4YspgqCDA2ove21IipXuFXXGy15bLZQKzVgr.aSIGHV6'),
  (10,'doctor','Dr. Demo Doctor H10 025','doctor.h10.025@govcare.test','GCD-H10-DOC-025','govcare-demo-network-v1:h10:doctor:025','DEMO-WARD-025','$2a$10$RUwj4lKTwcwi2ssh1CZ/ReS6kgLcZS7ufxS1pFhkExrE0i.RDUKI2'),
  (10,'doctor','Dr. Demo Doctor H10 026','doctor.h10.026@govcare.test','GCD-H10-DOC-026','govcare-demo-network-v1:h10:doctor:026','DEMO-WARD-026','$2a$10$Qy61/CmzetR6M0XjX5htF.te7XE96Y.jDSLBvqtmDRJIMAyscasiy'),
  (10,'doctor','Dr. Demo Doctor H10 027','doctor.h10.027@govcare.test','GCD-H10-DOC-027','govcare-demo-network-v1:h10:doctor:027','DEMO-WARD-027','$2a$10$rOve0kOLmlV9XLjAcX8GS.5Fbu0zwKRHHxh0MX4i9bPpEpiHLcaLK'),
  (10,'doctor','Dr. Demo Doctor H10 028','doctor.h10.028@govcare.test','GCD-H10-DOC-028','govcare-demo-network-v1:h10:doctor:028','DEMO-WARD-028','$2a$10$JTjLQb77EW02RKtAZQGFz.8GYOpd7WqjDvrBp/teuLczpqpkv9fw.'),
  (10,'doctor','Dr. Demo Doctor H10 029','doctor.h10.029@govcare.test','GCD-H10-DOC-029','govcare-demo-network-v1:h10:doctor:029','DEMO-WARD-029','$2a$10$kzHHaX0/lnIBCryBWXX0IuNLKIYUjyJ9PuPSNx98R.7Rqd2c/t2ka'),
  (10,'doctor','Dr. Demo Doctor H10 030','doctor.h10.030@govcare.test','GCD-H10-DOC-030','govcare-demo-network-v1:h10:doctor:030','DEMO-WARD-030','$2a$10$PJMJ1QXbd3juAcKyqcOC4.EnzEwPp2w0U13DgOGRHjjinFGr9wNcC'),
  (10,'doctor','Dr. Demo Doctor H10 031','doctor.h10.031@govcare.test','GCD-H10-DOC-031','govcare-demo-network-v1:h10:doctor:031','DEMO-WARD-031','$2a$10$MCY6m2NNowr9gemHLeTNDuJ5Tp4bHxVw/Dl.TtgY1xv.trMr4s2Xa'),
  (10,'doctor','Dr. Demo Doctor H10 032','doctor.h10.032@govcare.test','GCD-H10-DOC-032','govcare-demo-network-v1:h10:doctor:032','DEMO-WARD-032','$2a$10$TDvkokWcINpSZnswFt4CW.kYuU7XfxIt54MVWTD/Wpp9gp5T20GZa'),
  (10,'doctor','Dr. Demo Doctor H10 033','doctor.h10.033@govcare.test','GCD-H10-DOC-033','govcare-demo-network-v1:h10:doctor:033','DEMO-WARD-033','$2a$10$UUz794Hx.5hy3khQwyMw3eIm5ymmnEkz96tlfuPF7RLhyCLamJmCS'),
  (10,'doctor','Dr. Demo Doctor H10 034','doctor.h10.034@govcare.test','GCD-H10-DOC-034','govcare-demo-network-v1:h10:doctor:034','DEMO-WARD-034','$2a$10$1wSYm7RLfz9yABJqG15ITOQOl47lLX3vyO1S3p/LfHzbVijBK9wvm'),
  (10,'doctor','Dr. Demo Doctor H10 035','doctor.h10.035@govcare.test','GCD-H10-DOC-035','govcare-demo-network-v1:h10:doctor:035','DEMO-WARD-035','$2a$10$14eeTHuka589QgQbgFsg0OFsgaTSSOmKvX/M05xCEijUGZ9bBOAAW'),
  (10,'doctor','Dr. Demo Doctor H10 036','doctor.h10.036@govcare.test','GCD-H10-DOC-036','govcare-demo-network-v1:h10:doctor:036','DEMO-WARD-036','$2a$10$U0TE1QxBgbSuNXDPcM3ooOay0BoDfCvYW7o2o82.40/WHpgN0TiA6'),
  (10,'doctor','Dr. Demo Doctor H10 037','doctor.h10.037@govcare.test','GCD-H10-DOC-037','govcare-demo-network-v1:h10:doctor:037','DEMO-WARD-037','$2a$10$WL4wGyEA6mJDcDrBdKNll.iw9EyFKkpBmUdWqwEiGeIEHIj0AIoCi'),
  (10,'doctor','Dr. Demo Doctor H10 038','doctor.h10.038@govcare.test','GCD-H10-DOC-038','govcare-demo-network-v1:h10:doctor:038','DEMO-WARD-038','$2a$10$gb7i82vPIEIWh8b6y7tQ0eUWrow7eGZ4dSf8li7vKzFvM.iFWxWa6'),
  (10,'doctor','Dr. Demo Doctor H10 039','doctor.h10.039@govcare.test','GCD-H10-DOC-039','govcare-demo-network-v1:h10:doctor:039','DEMO-WARD-039','$2a$10$sqITznnpPAxGu4cOfHcwfO1dnpmsAQupTEGIpruW.AVO4cFYitXiS'),
  (10,'doctor','Dr. Demo Doctor H10 040','doctor.h10.040@govcare.test','GCD-H10-DOC-040','govcare-demo-network-v1:h10:doctor:040','DEMO-WARD-040','$2a$10$6VgGLi2tjOgmIZTUuysI5Odb6SdlFmKX.rx31s6STLO3Gl7ubY9ZG'),
  (10,'doctor','Dr. Demo Doctor H10 041','doctor.h10.041@govcare.test','GCD-H10-DOC-041','govcare-demo-network-v1:h10:doctor:041','DEMO-WARD-041','$2a$10$6e1tEC/7N7qNgPKF6NEoTOvltA8VvNoqTkSQF8F0BOwV2MNErV3P.'),
  (10,'doctor','Dr. Demo Doctor H10 042','doctor.h10.042@govcare.test','GCD-H10-DOC-042','govcare-demo-network-v1:h10:doctor:042','DEMO-WARD-042','$2a$10$mLlhpu1c5QtIW5A0Q7UlIeX4NHYPiHSZdvTq1hboNyMT3iPbUicKC'),
  (10,'doctor','Dr. Demo Doctor H10 043','doctor.h10.043@govcare.test','GCD-H10-DOC-043','govcare-demo-network-v1:h10:doctor:043','DEMO-WARD-043','$2a$10$mTm4ACWe0.S326hChAJcsejWCSk0TfpAVj1RH1u7JcCI1qeL6OOQG'),
  (10,'doctor','Dr. Demo Doctor H10 044','doctor.h10.044@govcare.test','GCD-H10-DOC-044','govcare-demo-network-v1:h10:doctor:044','DEMO-WARD-044','$2a$10$QhjwWFAc9K.DKW2l5j4cAuOr9TcCyeW1NfWTsV/5kXDSjD4wIJ62K'),
  (10,'doctor','Dr. Demo Doctor H10 045','doctor.h10.045@govcare.test','GCD-H10-DOC-045','govcare-demo-network-v1:h10:doctor:045','DEMO-WARD-045','$2a$10$hUxMcBa4yoiKt6atTFMtP.mRamEnIzxtjsqCEjqNUEsQL/8Xmc.iG'),
  (10,'doctor','Dr. Demo Doctor H10 046','doctor.h10.046@govcare.test','GCD-H10-DOC-046','govcare-demo-network-v1:h10:doctor:046','DEMO-WARD-046','$2a$10$pL0wxS3e/bex1Kzk3j7Ee.ou3ZTFGq/X1W5xwaExb7S.mgz3lzcsa'),
  (10,'doctor','Dr. Demo Doctor H10 047','doctor.h10.047@govcare.test','GCD-H10-DOC-047','govcare-demo-network-v1:h10:doctor:047','DEMO-WARD-047','$2a$10$uZK7gQSEAXRmt0TYK1gPb.mZpnYeEXa1/J4r1ryOkMepj8JtgFc7y'),
  (10,'doctor','Dr. Demo Doctor H10 048','doctor.h10.048@govcare.test','GCD-H10-DOC-048','govcare-demo-network-v1:h10:doctor:048','DEMO-WARD-048','$2a$10$xD2OAWucDRZz/Svoo5pQfuBLiopP23uOs2hcNu7KQuV.kFfcenERS'),
  (10,'doctor','Dr. Demo Doctor H10 049','doctor.h10.049@govcare.test','GCD-H10-DOC-049','govcare-demo-network-v1:h10:doctor:049','DEMO-WARD-049','$2a$10$It7ovxA2rLb8pBwdrYti.uQ3xvD3JWgtYOnAWrhwCVHWdZjDtgkdm'),
  (10,'doctor','Dr. Demo Doctor H10 050','doctor.h10.050@govcare.test','GCD-H10-DOC-050','govcare-demo-network-v1:h10:doctor:050','DEMO-WARD-050','$2a$10$Wv1ag0d8rE3TfKHDaiMENuJ3oywcHv7W2jqm.cJaXH3lqF9MJtcAq'),
  (10,'doctor','Dr. Demo Doctor H10 051','doctor.h10.051@govcare.test','GCD-H10-DOC-051','govcare-demo-network-v1:h10:doctor:051','DEMO-WARD-051','$2a$10$OhVP69T5t8oc4LXqnC/tI.wxVfbT3mXeKMYAisygtutout2FlIX2S'),
  (10,'doctor','Dr. Demo Doctor H10 052','doctor.h10.052@govcare.test','GCD-H10-DOC-052','govcare-demo-network-v1:h10:doctor:052','DEMO-WARD-052','$2a$10$bG1ks/9a.EfUZrwX6I8ove.Zq6Gbk8lbnKMoniMllU2/fSS1So5Ve'),
  (10,'doctor','Dr. Demo Doctor H10 053','doctor.h10.053@govcare.test','GCD-H10-DOC-053','govcare-demo-network-v1:h10:doctor:053','DEMO-WARD-053','$2a$10$Wdxr5kV3iEpYaA19bluvOuemwtMWrASUZ0FYIqLeQ0c0hRvdySoyK'),
  (10,'doctor','Dr. Demo Doctor H10 054','doctor.h10.054@govcare.test','GCD-H10-DOC-054','govcare-demo-network-v1:h10:doctor:054','DEMO-WARD-054','$2a$10$eQYpTmegaXRNRdVCdZX3q.Y8fvtFPZLIa25BOlyWnsLazmzOyar2i'),
  (10,'doctor','Dr. Demo Doctor H10 055','doctor.h10.055@govcare.test','GCD-H10-DOC-055','govcare-demo-network-v1:h10:doctor:055','DEMO-WARD-055','$2a$10$EeOh1qJpLm5fyH/rrWdwKe0tKdUC8OiO4.QteGnHQwMjvF2ssGh6m'),
  (10,'doctor','Dr. Demo Doctor H10 056','doctor.h10.056@govcare.test','GCD-H10-DOC-056','govcare-demo-network-v1:h10:doctor:056','DEMO-WARD-056','$2a$10$iz7PZmf0CC2rEKy10/GRVuFo4Ew7MxE3xIHvfXlnIrhjF0VJ5A0oW'),
  (10,'doctor','Dr. Demo Doctor H10 057','doctor.h10.057@govcare.test','GCD-H10-DOC-057','govcare-demo-network-v1:h10:doctor:057','DEMO-WARD-057','$2a$10$ztPeWU/nU6yUSULdawLAj.kyTw9oioub6jHQ8.FKD7SU1D.9wTIGG'),
  (10,'doctor','Dr. Demo Doctor H10 058','doctor.h10.058@govcare.test','GCD-H10-DOC-058','govcare-demo-network-v1:h10:doctor:058','DEMO-WARD-058','$2a$10$onGVaRisPr8m3wQocVFYZ.ECy1sGI6Yob8nH0qc62YWLeB.JDiOo.'),
  (10,'doctor','Dr. Demo Doctor H10 059','doctor.h10.059@govcare.test','GCD-H10-DOC-059','govcare-demo-network-v1:h10:doctor:059','DEMO-WARD-059','$2a$10$MZ.Fu6g/H0gNZt1MoDDaT..PWDQcrEFISCwo4sHQKaxwNZXW1xYO.'),
  (10,'doctor','Dr. Demo Doctor H10 060','doctor.h10.060@govcare.test','GCD-H10-DOC-060','govcare-demo-network-v1:h10:doctor:060','DEMO-WARD-060','$2a$10$lyn./RWJdeIA/iz4OUwpQeq7fZMidoZwC7SHGm8Z5.GLMNYiHMfD2'),
  (10,'doctor','Dr. Demo Doctor H10 061','doctor.h10.061@govcare.test','GCD-H10-DOC-061','govcare-demo-network-v1:h10:doctor:061','DEMO-WARD-061','$2a$10$lZtPjPgknFkHfsnELS7FN.jxQHL3ut3AUix9GReYqqbir2V575ib.'),
  (10,'doctor','Dr. Demo Doctor H10 062','doctor.h10.062@govcare.test','GCD-H10-DOC-062','govcare-demo-network-v1:h10:doctor:062','DEMO-WARD-062','$2a$10$KPJ58SyPVX4MGuR3lTv.1eYjv5Ly6nQGi5eCxg4PydnjGm9pG7MOG'),
  (10,'doctor','Dr. Demo Doctor H10 063','doctor.h10.063@govcare.test','GCD-H10-DOC-063','govcare-demo-network-v1:h10:doctor:063','DEMO-WARD-063','$2a$10$OByqXrrTf7nQ4prEtkSh.unyS9cHtQeSi2r5fjFDIXuHX8uAEL1LO'),
  (10,'doctor','Dr. Demo Doctor H10 064','doctor.h10.064@govcare.test','GCD-H10-DOC-064','govcare-demo-network-v1:h10:doctor:064','DEMO-WARD-064','$2a$10$fOQ3H6X.FFc21O.W6SqpGOKunm.cJ/affdFrtycbBd2fUARjiZ.jG'),
  (10,'doctor','Dr. Demo Doctor H10 065','doctor.h10.065@govcare.test','GCD-H10-DOC-065','govcare-demo-network-v1:h10:doctor:065','DEMO-WARD-065','$2a$10$tqi6ncW8SkdVrWCAn2DbVu9aKvriZr2GSBEEb3PY6bQxE473opp4C'),
  (10,'doctor','Dr. Demo Doctor H10 066','doctor.h10.066@govcare.test','GCD-H10-DOC-066','govcare-demo-network-v1:h10:doctor:066','DEMO-WARD-066','$2a$10$eAUaiJOZ.ilq0xXtT9lA6.4/TSjQHYA.6nM/KXcNDbg682uXMoRyq'),
  (10,'doctor','Dr. Demo Doctor H10 067','doctor.h10.067@govcare.test','GCD-H10-DOC-067','govcare-demo-network-v1:h10:doctor:067','DEMO-WARD-067','$2a$10$/hNP3UXQhCscTz/jEZa1JekY9XeCovQeEn1eDI4TO4UiDq2k8QN9K'),
  (10,'doctor','Dr. Demo Doctor H10 068','doctor.h10.068@govcare.test','GCD-H10-DOC-068','govcare-demo-network-v1:h10:doctor:068','DEMO-WARD-068','$2a$10$MVJ/6.nKvKUGnH9r01yTgO0UsGLlKU6ePmESmKxjKtvKVAcHT6IZO'),
  (10,'doctor','Dr. Demo Doctor H10 069','doctor.h10.069@govcare.test','GCD-H10-DOC-069','govcare-demo-network-v1:h10:doctor:069','DEMO-WARD-069','$2a$10$cGQ0jJv5e/b.3nhT7JuPduTPOglHVCZAfaRKlAdJT0oh5E9ev4U8K'),
  (10,'doctor','Dr. Demo Doctor H10 070','doctor.h10.070@govcare.test','GCD-H10-DOC-070','govcare-demo-network-v1:h10:doctor:070','DEMO-WARD-070','$2a$10$lXxqVM.J6WtZcPdFLWWNleO74PJzFc07WEzU6gPhAOsV1Qr3YXe8C'),
  (10,'doctor','Dr. Demo Doctor H10 071','doctor.h10.071@govcare.test','GCD-H10-DOC-071','govcare-demo-network-v1:h10:doctor:071','DEMO-WARD-071','$2a$10$oZUUNCiAko7wW1zlUiqCb.xU37vIxwnTQK1ADubg9NSASzUFffPDK'),
  (10,'doctor','Dr. Demo Doctor H10 072','doctor.h10.072@govcare.test','GCD-H10-DOC-072','govcare-demo-network-v1:h10:doctor:072','DEMO-WARD-072','$2a$10$.ALZSraQTk8ubFypMIzZpuob6F7gNsyGaLrHYQkR8rpTST6cJcZPG'),
  (10,'doctor','Dr. Demo Doctor H10 073','doctor.h10.073@govcare.test','GCD-H10-DOC-073','govcare-demo-network-v1:h10:doctor:073','DEMO-WARD-073','$2a$10$TCX9j1i35SwtalDWhx2xFuQkbkOQvQsTLFgspswiliRw7Jhvj85Ei'),
  (10,'doctor','Dr. Demo Doctor H10 074','doctor.h10.074@govcare.test','GCD-H10-DOC-074','govcare-demo-network-v1:h10:doctor:074','DEMO-WARD-074','$2a$10$Va7KBOcFwSOXxus/Zs5I5Oi454yihBZseZxFeWX.aS8taoh3Lbzlm'),
  (10,'doctor','Dr. Demo Doctor H10 075','doctor.h10.075@govcare.test','GCD-H10-DOC-075','govcare-demo-network-v1:h10:doctor:075','DEMO-WARD-075','$2a$10$0yfXXmG7kZ0q5hUiZCX3BeAULv40qg1hb52XsEPQhx57ULNzh8Cl2'),
  (10,'doctor','Dr. Demo Doctor H10 076','doctor.h10.076@govcare.test','GCD-H10-DOC-076','govcare-demo-network-v1:h10:doctor:076','DEMO-WARD-076','$2a$10$9W1.wFB0xhH1q/S00P.zlOBXESz27jxAGC5DHmtTLZXCQq1ImOo2u'),
  (10,'doctor','Dr. Demo Doctor H10 077','doctor.h10.077@govcare.test','GCD-H10-DOC-077','govcare-demo-network-v1:h10:doctor:077','DEMO-WARD-077','$2a$10$qmsiYimPLovr.QV5XuUNwO/bevVwG0anFy6yxJ/Q8TgwEwXz0Cz2G'),
  (10,'doctor','Dr. Demo Doctor H10 078','doctor.h10.078@govcare.test','GCD-H10-DOC-078','govcare-demo-network-v1:h10:doctor:078','DEMO-WARD-078','$2a$10$ww2xKR1cQwIjRHlSTrrYZewpehC/rgOecihzHQPy8eSPLhsVJg4KO'),
  (10,'doctor','Dr. Demo Doctor H10 079','doctor.h10.079@govcare.test','GCD-H10-DOC-079','govcare-demo-network-v1:h10:doctor:079','DEMO-WARD-079','$2a$10$6iCZPxLW2hbJyoA60id.4OwbmsgP3tEtB/j/qXyQrsjNX6W4ADaLi'),
  (10,'doctor','Dr. Demo Doctor H10 080','doctor.h10.080@govcare.test','GCD-H10-DOC-080','govcare-demo-network-v1:h10:doctor:080','DEMO-WARD-080','$2a$10$LV39hzusGhHjV2.b4S831O26.HGvGPaJvU4Sp4bAAFv7dMGiAKLuq'),
  (10,'doctor','Dr. Demo Doctor H10 081','doctor.h10.081@govcare.test','GCD-H10-DOC-081','govcare-demo-network-v1:h10:doctor:081','DEMO-WARD-081','$2a$10$KCLerx4JOBh6QF8R/sRabujdoSqnsMoWrhh3CHMpgYuqyQg9Wnz9e'),
  (10,'doctor','Dr. Demo Doctor H10 082','doctor.h10.082@govcare.test','GCD-H10-DOC-082','govcare-demo-network-v1:h10:doctor:082','DEMO-WARD-082','$2a$10$4ecdXhgXqojaCMUotR6Qc.xK/e7HPJivDRblvUYHh75CBTpQm3pnK'),
  (10,'doctor','Dr. Demo Doctor H10 083','doctor.h10.083@govcare.test','GCD-H10-DOC-083','govcare-demo-network-v1:h10:doctor:083','DEMO-WARD-083','$2a$10$SNhZqbFbrMISJ1ZgeTQUQuIkgn2uxa8uqI0sjOYU8oGyJ8vgFvuAm'),
  (10,'doctor','Dr. Demo Doctor H10 084','doctor.h10.084@govcare.test','GCD-H10-DOC-084','govcare-demo-network-v1:h10:doctor:084','DEMO-WARD-084','$2a$10$88BG3r4kKDk6L7OcFOKx8ep4JsLzxfAwol/mtKWqUt7pNcYPaX3tu'),
  (10,'doctor','Dr. Demo Doctor H10 085','doctor.h10.085@govcare.test','GCD-H10-DOC-085','govcare-demo-network-v1:h10:doctor:085','DEMO-WARD-085','$2a$10$FZF6pDAdgjHD7QWUlDrtxOcBVt.Z0oQGRrWt.7cKyoVi9Do9JX0Ci'),
  (10,'doctor','Dr. Demo Doctor H10 086','doctor.h10.086@govcare.test','GCD-H10-DOC-086','govcare-demo-network-v1:h10:doctor:086','DEMO-WARD-086','$2a$10$TeLiZnkZLfNh4NwL0v4.iOFb9R7c7L6nC5CTidMo5gLGPAKgLDGkS'),
  (10,'doctor','Dr. Demo Doctor H10 087','doctor.h10.087@govcare.test','GCD-H10-DOC-087','govcare-demo-network-v1:h10:doctor:087','DEMO-WARD-087','$2a$10$rItMqUesa0Jrewvy/8K6U.VULyOdawt7aXPnbLPcgq6r3qYm38wXm'),
  (10,'doctor','Dr. Demo Doctor H10 088','doctor.h10.088@govcare.test','GCD-H10-DOC-088','govcare-demo-network-v1:h10:doctor:088','DEMO-WARD-088','$2a$10$9Hb/ewEIjMsOJ1ONEGFokerR/id5U9tjmHZA8j6xTmfAHTTcuPk4C'),
  (10,'doctor','Dr. Demo Doctor H10 089','doctor.h10.089@govcare.test','GCD-H10-DOC-089','govcare-demo-network-v1:h10:doctor:089','DEMO-WARD-089','$2a$10$U9biDwPzqywYYa8S4adw..bxm9QN55hUKjDKXKnfpaQIknhnPOH9K'),
  (10,'doctor','Dr. Demo Doctor H10 090','doctor.h10.090@govcare.test','GCD-H10-DOC-090','govcare-demo-network-v1:h10:doctor:090','DEMO-WARD-090','$2a$10$QLWBt97SnZRsUEbpprVCDucpGGUz4Em5mxkVbUsOg0o2spgfFuVUq'),
  (10,'doctor','Dr. Demo Doctor H10 091','doctor.h10.091@govcare.test','GCD-H10-DOC-091','govcare-demo-network-v1:h10:doctor:091','DEMO-WARD-091','$2a$10$HFGy0HE6fZmam1c7ddrMUuV4DxWAGn18Vsh4hbCOoc0sTaP36uhMW'),
  (10,'doctor','Dr. Demo Doctor H10 092','doctor.h10.092@govcare.test','GCD-H10-DOC-092','govcare-demo-network-v1:h10:doctor:092','DEMO-WARD-092','$2a$10$I7BXn8BHKkwOw.dCJ5AVPOO5MZ8OFnZM0bAjXPsIL/WoYtYwxE7hC'),
  (10,'doctor','Dr. Demo Doctor H10 093','doctor.h10.093@govcare.test','GCD-H10-DOC-093','govcare-demo-network-v1:h10:doctor:093','DEMO-WARD-093','$2a$10$/TolygfNzwZvsdlqvmpeo.IRUCiBHn/rycnyUcxq9MnkfkPAIWr12'),
  (10,'doctor','Dr. Demo Doctor H10 094','doctor.h10.094@govcare.test','GCD-H10-DOC-094','govcare-demo-network-v1:h10:doctor:094','DEMO-WARD-094','$2a$10$9ITiCCqFtwpukICGBjKLOerecXO3GJU4J5sz5.epe9EdG7fEQCLT2'),
  (10,'doctor','Dr. Demo Doctor H10 095','doctor.h10.095@govcare.test','GCD-H10-DOC-095','govcare-demo-network-v1:h10:doctor:095','DEMO-WARD-095','$2a$10$3jpJ9cLa7jSNol/CClUJ/uOIT0iNNkCJBGXoypewhWpCCC07Bd1SG'),
  (10,'doctor','Dr. Demo Doctor H10 096','doctor.h10.096@govcare.test','GCD-H10-DOC-096','govcare-demo-network-v1:h10:doctor:096','DEMO-WARD-096','$2a$10$LkkIXl4o2PyxtvHU7.t4Guvia41Crpk.Ml4pQ8.mcDkfd58c6ppEK'),
  (10,'doctor','Dr. Demo Doctor H10 097','doctor.h10.097@govcare.test','GCD-H10-DOC-097','govcare-demo-network-v1:h10:doctor:097','DEMO-WARD-097','$2a$10$inFZASQ1M1Y3W3gYu5k3MOH/m5ZPyQTPQZ42X6aOKitJ1pHfVOxmq'),
  (10,'doctor','Dr. Demo Doctor H10 098','doctor.h10.098@govcare.test','GCD-H10-DOC-098','govcare-demo-network-v1:h10:doctor:098','DEMO-WARD-098','$2a$10$GMT0yPZW42DXvmZ8MUXXtuhqvv.yrmFRPvO4FjdV0NzG/n8cfEB4.'),
  (10,'doctor','Dr. Demo Doctor H10 099','doctor.h10.099@govcare.test','GCD-H10-DOC-099','govcare-demo-network-v1:h10:doctor:099','DEMO-WARD-099','$2a$10$VVP8i3MLGWgldDmStIuMdebVv5BDmO4dO3Xe54G2BCS9F2hyY1Tku'),
  (10,'doctor','Dr. Demo Doctor H10 100','doctor.h10.100@govcare.test','GCD-H10-DOC-100','govcare-demo-network-v1:h10:doctor:100','DEMO-WARD-100','$2a$10$zWSRNN86.kKLyaJfHirrnujxjKNlwnKVv5z4fzykpjuYLCANh8m5i'),
  (10,'hospital_admin','Demo Hospital Admin H10','admin.h10@govcare.test','GCD-H10-ADMIN','govcare-demo-network-v1:h10:hospital_admin','ADMIN','$2a$10$RNEh3WD1E9Xn66uOdqdwzuxUdMH1blQIt03nfP1uwTm9fN1Af4W36'),
  (10,'receptionist','Demo Front Desk Officer H10','reception.h10@govcare.test','GCD-H10-RECEPTION','govcare-demo-network-v1:h10:receptionist','RECEPTION','$2a$10$5ZoC3i6SX0RSo9aNlkGpTOcquu1Cg25XKNnfLfJsJoqmKBpUNcjhe'),
  (10,'nurse','Demo Nurse H10','nurse.h10@govcare.test','GCD-H10-NURSE','govcare-demo-network-v1:h10:nurse','DEMO-WARD-001','$2a$10$2kxQqF.oZI0casDbDaJOsuL8Rvp0OonTJYC1t9.qbj1smqLyd9YGG'),
  (10,'ward_manager','Demo Ward Manager H10','wardmanager.h10@govcare.test','GCD-H10-WARDMANAGER','govcare-demo-network-v1:h10:ward_manager','DEMO-WARD-001','$2a$10$411ZcEDun8s8jW7WMP2.gOfNpyw42aEBUtAZkyHNYVAoHt3BaeeJa'),
  (10,'patient','Demo Patient Portal User H10','patient.h10@govcare.test','GCD-H10-PATIENT','govcare-demo-network-v1:h10:patient',null,'$2a$10$eSpXHGhYFaJwX.m9AEQhouYJujuKe8Ynw0Vxtp3M4FjOeffMpMfHi'),
  (10,'guardian','Demo Guardian Portal User H10','guardian.h10@govcare.test','GCD-H10-GUARDIAN','govcare-demo-network-v1:h10:guardian',null,'$2a$10$GqvQvxTZ1vrgenMxKFMJZOs.l1q0JFuPIt2IYwQDyUqtpoMOvtUu.')
;

do $$
begin
  if exists(select 1 from _gc_demo_accounts fixture join app_users u on
      lower(u.email)=fixture.email or u.employee_no=fixture.employee_no or u.auth_uid=fixture.auth_uid
      left join hospitals h on h.id=u.hospital_id
      where u.auth_uid is distinct from fixture.auth_uid
        or lower(u.email) is distinct from fixture.email
        or u.employee_no is distinct from fixture.employee_no
        or h.code is distinct from 'DEMO-HOSP-'||lpad(fixture.hospital_index::text,2,'0')) then
    raise exception 'A reserved demo account identifier is already in use. No accounts were changed.';
  end if;
end $$;

insert into hospitals(code,name,type,city,district,province,address,email,settings,status)
select 'DEMO-HOSP-'||lpad(i::text,2,'0'),
       'GovCare Demo Hospital '||lpad(i::text,2,'0'), 'demo_hospital',
       x.city,x.district,x.province,
       'Synthetic demo address '||lpad(i::text,2,'0')||', '||x.city,
       'hospital.h'||lpad(i::text,2,'0')||'@govcare.test',
       jsonb_build_object('govcare_demo_fixture','network-v1','synthetic',true), 'active'::record_status
from generate_series(1,10) i join (values
  (1,'Colombo','Colombo','Western'),(2,'Kandy','Kandy','Central'),
  (3,'Galle','Galle','Southern'),(4,'Jaffna','Jaffna','Northern'),
  (5,'Trincomalee','Trincomalee','Eastern'),(6,'Kurunegala','Kurunegala','North Western'),
  (7,'Anuradhapura','Anuradhapura','North Central'),(8,'Badulla','Badulla','Uva'),
  (9,'Ratnapura','Ratnapura','Sabaragamuwa'),(10,'Gampaha','Gampaha','Western')
) x(idx,city,district,province) on x.idx=i
on conflict(code) do nothing;

create temporary table _gc_demo_hospitals on commit drop as
select h.*,right(h.code,2)::integer as fixture_index
from hospitals h where h.code ~ '^DEMO-HOSP-(0[1-9]|10)$'
  and h.settings->>'govcare_demo_fixture'='network-v1';

insert into departments(hospital_id,code,name,type,status)
select h.id,x.code,x.name,x.type,'active'::record_status
from _gc_demo_hospitals h cross join(values
  ('ADMIN','Demo Administration','administrative'),('RECEPTION','Demo Reception','administrative'),
  ('OPD','Demo Out Patient Department','clinical'),('LAB','Demo Laboratory','diagnostic'),
  ('RAD','Demo Radiology','diagnostic'),('PHA','Demo Pharmacy','support')
) x(code,name,type)
on conflict(hospital_id,code) do nothing;

-- Separate ward departments make department-scoped nursing access meaningful.
insert into departments(hospital_id,code,name,type,status)
select h.id,'DEMO-WARD-'||lpad(n::text,3,'0'),
       'Demo Ward Department '||lpad(n::text,3,'0'),'clinical','active'::record_status
from _gc_demo_hospitals h cross join generate_series(1,100) n
on conflict(hospital_id,code) do nothing;

insert into guardians(hospital_id,guardian_no,nic,full_name,relationship,address,district,email,status)
select h.id,'GRD-NET-'||right(h.code,2)||'-0001','DEMO-GRD-NIC-H'||right(h.code,2),
       'Demo Guardian H'||right(h.code,2),'Parent',h.address,h.district,
       'guardian.h'||right(h.code,2)||'@govcare.test','active'::record_status
from _gc_demo_hospitals h
on conflict(hospital_id,guardian_no) do nothing;

insert into patients(hospital_id,patient_no,guardian_id,nic,birth_certificate_no,title,
  full_name,preferred_name,date_of_birth,age_years,gender,blood_group,nationality,
  address,district,province,email,emergency_contact,language_preference,
  allergies,chronic_diseases,disabilities,family_history,risk_flags,qr_payload,release_status,status,created_at)
select h.id,'PAT-NET-H'||right(h.code,2)||'-'||lpad(n::text,4,'0'),
       case when n=1 then g.id end,
       case when n<>1 then 'DEMO-NIC-H'||right(h.code,2)||'-'||lpad(n::text,4,'0') end,
       case when n=1 then 'DEMO-BC-H'||right(h.code,2)||'-0001' end,
       case when n=1 then 'Master' when mod(n,2)=0 then 'Ms' else 'Mr' end,
       'Demo Patient H'||right(h.code,2)||' '||lpad(n::text,4,'0'),
       'Demo H'||right(h.code,2)||'-'||lpad(n::text,4,'0'),dob,
       extract(year from age(current_date,dob))::integer,
       case when mod(n,2)=0 then 'female'::gender_value else 'male'::gender_value end,
       (array['O+','A+','B+','AB+','O-','A-','B-','AB-'])[mod(n-1,8)+1],
       'Sri Lankan','Synthetic patient address '||n||', '||h.city,h.district,h.province,
       'patient.h'||right(h.code,2)||'.'||lpad(n::text,4,'0')||'@govcare.test',
       jsonb_build_object('name','Demo Emergency Contact H'||right(h.code,2)||'-'||n,'relationship','Family'),
       'en','[]'::jsonb,'[]'::jsonb,'[]'::jsonb,'[]'::jsonb,
       '["demo_network_v1"]'::jsonb,
       jsonb_build_object('patientId','PAT-NET-H'||right(h.code,2)||'-'||lpad(n::text,4,'0'),'hospitalId',h.id)::text,
       'released'::release_status,'active'::record_status,
       now() - mod(n-1,120)*interval '1 day'
from _gc_demo_hospitals h cross join generate_series(1,400) n
join guardians g on g.hospital_id=h.id and g.guardian_no='GRD-NET-'||right(h.code,2)||'-0001'
cross join lateral(select case when n=1 then (current_date-interval '8 years')::date
                        else date '1945-01-01'+mod(n*97,22000) end dob) birthday
on conflict(hospital_id,patient_no) do nothing;

insert into app_users(auth_uid,hospital_id,department_id,patient_id,role,role_id,
  full_name,email,password_hash,permissions,mfa_enabled,status,employee_no,title,
  job_title,employment_type,joining_date,work_status,must_change_password,credentials_version)
select a.auth_uid,h.id,d.id,case when a.role_code in ('patient','guardian') then p.id end,
       a.role_code::user_role,r.id,a.full_name,a.email,a.password_hash,
       '[]'::jsonb,false,'active'::record_status,a.employee_no,
       case when a.role_code='doctor' then 'Dr' end,
       'Demo '||r.name,'temporary',current_date,'active',true,0
from _gc_demo_accounts a
join _gc_demo_hospitals h on h.fixture_index=a.hospital_index
join roles r on r.code=a.role_code
left join departments d on d.hospital_id=h.id and d.code=a.department_code
left join patients p on p.hospital_id=h.id and p.patient_no='PAT-NET-H'||right(h.code,2)||'-0001'
on conflict do nothing;

create temporary table _gc_demo_ward_map on commit drop as
select h.id as hospital_id,h.code as hospital_code,n as ward_index,
       d.id as department_id,u.id as doctor_id,
       case when n<=60 then 'GENERAL_MEDICAL_WARD' when n<=80 then 'SURGICAL_WARD'
            when n<=90 then 'OBSERVATION_WARD' when n<=94 then 'INTENSIVE_CARE_UNIT'
            when n<=97 then 'HIGH_DEPENDENCY_UNIT' else 'ISOLATION_WARD' end as ward_type
from _gc_demo_hospitals h cross join generate_series(1,100) n
join departments d on d.hospital_id=h.id and d.code='DEMO-WARD-'||lpad(n::text,3,'0')
join app_users u on u.hospital_id=h.id
 and u.email='doctor.h'||right(h.code,2)||'.'||lpad(n::text,3,'0')||'@govcare.test';

insert into wards(hospital_id,department_id,ward_no,ward_code,name,category,ward_type,
  floor,building,capacity,nurse_station,gender_restriction,age_restriction,isolation_capable,
  ward_manager_id,responsible_consultant_id,operational_status,status)
select m.hospital_id,m.department_id,'DEMO-W-'||lpad(m.ward_index::text,3,'0'),
       'DEMO-W-'||lpad(m.ward_index::text,3,'0'),
       'Demo '||initcap(replace(m.ward_type,'_',' '))||' '||lpad(m.ward_index::text,3,'0'),
       case when m.ward_type='INTENSIVE_CARE_UNIT' then 'icu'
            when m.ward_type='HIGH_DEPENDENCY_UNIT' then 'hdu'
            when m.ward_type='ISOLATION_WARD' then 'isolation' else 'male' end,
       m.ward_type,((m.ward_index-1)/20+1)::text,'Demo Building '||((m.ward_index-1)/50+1),
       8,'Demo Nurse Station '||m.ward_index,'ANY','ANY',m.ward_type='ISOLATION_WARD',
       case when m.ward_index=1 then manager.id end,m.doctor_id,'ACTIVE','active'::record_status
from _gc_demo_ward_map m
join app_users manager on manager.hospital_id=m.hospital_id
  and manager.email='wardmanager.h'||right(m.hospital_code,2)||'@govcare.test'
on conflict(hospital_id,ward_code) do nothing;

insert into ward_rooms(ward_id,room_number,room_name,room_type,floor,maximum_beds,
  gender_restriction,isolation_room,oxygen_available,ventilator_support,status)
select w.id,'DEMO-ROOM-01','Demo Room 01',
       case when w.ward_type='INTENSIVE_CARE_UNIT' then 'ICU'
            when w.ward_type='HIGH_DEPENDENCY_UNIT' then 'HDU'
            when w.ward_type='ISOLATION_WARD' then 'ISOLATION' else 'GENERAL' end,
       w.floor,8,'ANY',w.isolation_capable,
       w.ward_type in ('INTENSIVE_CARE_UNIT','HIGH_DEPENDENCY_UNIT'),
       w.ward_type='INTENSIVE_CARE_UNIT','ACTIVE'
from wards w join _gc_demo_ward_map m on m.hospital_id=w.hospital_id
  and w.ward_code='DEMO-W-'||lpad(m.ward_index::text,3,'0')
on conflict(ward_id,room_number) do nothing;

insert into beds(hospital_id,ward_id,room_id,bed_no,bed_code,bed_type,room_no,floor,
  status,gender_restriction,age_restriction,isolation_support,oxygen_support,ventilator_support,monitor_support)
select w.hospital_id,w.id,r.id,'B-'||lpad(b::text,2,'0'),
       'DEMO-B-'||lpad(m.ward_index::text,3,'0')||'-'||lpad(b::text,2,'0'),
       case when w.ward_type='INTENSIVE_CARE_UNIT' then 'ICU'
            when w.ward_type='HIGH_DEPENDENCY_UNIT' then 'HDU'
            when w.isolation_capable then 'ISOLATION' else 'STANDARD' end,
       r.room_number,w.floor,'AVAILABLE','ANY','ANY',w.isolation_capable,
       r.oxygen_available,r.ventilator_support,r.oxygen_available
from wards w join _gc_demo_ward_map m on m.hospital_id=w.hospital_id
  and w.ward_code='DEMO-W-'||lpad(m.ward_index::text,3,'0')
join ward_rooms r on r.ward_id=w.id and r.room_number='DEMO-ROOM-01'
cross join generate_series(1,8) b
on conflict(hospital_id,bed_code) do nothing;

create temporary table _gc_demo_patient_map on commit drop as
select p.id as patient_id,p.patient_no,m.hospital_id,m.hospital_code,m.doctor_id,
       m.department_id,w.id as ward_id,r.id as room_id,b.id as bed_id,n as patient_index,
       (n-1)%4<2 as inpatient
from _gc_demo_ward_map m
join wards w on w.hospital_id=m.hospital_id and w.ward_code='DEMO-W-'||lpad(m.ward_index::text,3,'0')
join ward_rooms r on r.ward_id=w.id and r.room_number='DEMO-ROOM-01'
cross join lateral generate_series((m.ward_index-1)*4+1,m.ward_index*4) n
join patients p on p.hospital_id=m.hospital_id and p.patient_no='PAT-NET-H'||right(m.hospital_code,2)||'-'||lpad(n::text,4,'0')
join beds b on b.ward_id=w.id and b.bed_no='B-'||lpad((((n-1)%4)+1)::text,2,'0');

insert into appointments(hospital_id,patient_id,doctor_id,department_id,appointment_no,
  appointment_type,scheduled_at,reason,priority,workflow_status,checked_in_at,status,created_by)
select m.hospital_id,m.patient_id,m.doctor_id,m.department_id,
       'APT-NET-H'||right(m.hospital_code,2)||'-'||lpad(m.patient_index::text,4,'0'),
       'opd',current_date+time '09:00'+(m.patient_index%30)*interval '10 minutes',
       'Synthetic demo appointment; no clinical diagnosis supplied','routine'::priority_level,
       'checked_in',now()-interval '20 minutes','pending'::record_status,m.doctor_id
from _gc_demo_patient_map m where not m.inpatient
on conflict do nothing;

insert into visits(hospital_id,patient_id,department_id,doctor_id,visit_no,visit_type,
  reason,priority,checked_at,completed_at,status,created_by,updated_by,appointment_id,workflow_status,created_at)
select m.hospital_id,m.patient_id,m.department_id,m.doctor_id,
       'VIS-NET-H'||right(m.hospital_code,2)||'-'||lpad(m.patient_index::text,4,'0'),
       case when m.inpatient then 'inpatient' else 'opd' end,
       'Synthetic demo clinical assignment; no clinical diagnosis supplied','routine'::priority_level,
       case when m.inpatient then now()-interval '1 day' else now()-interval '20 minutes' end,
       case when m.inpatient then now()-interval '1 day' end,
       case when m.inpatient then 'completed'::record_status else 'pending'::record_status end,
       m.doctor_id,m.doctor_id,a.id,case when m.inpatient then 'completed' else 'waiting' end,
       now()-mod(m.patient_index-1,14)*interval '1 day'
from _gc_demo_patient_map m
left join appointments a on a.hospital_id=m.hospital_id
  and a.appointment_no='APT-NET-H'||right(m.hospital_code,2)||'-'||lpad(m.patient_index::text,4,'0')
on conflict(hospital_id,visit_no) do nothing;

insert into opd_queue(id,hospital_id,visit_id,patient_id,department_id,doctor_id,token_no,
  queue_status,priority,estimated_wait_minutes,called_at,called_by,created_by,updated_by,appointment_id,created_at)
select md5('govcare-demo-network-v1:queue:'||m.patient_id)::uuid,
       m.hospital_id,v.id,m.patient_id,m.department_id,m.doctor_id,
       'DEMO-Q-H'||right(m.hospital_code,2)||'-'||lpad(m.patient_index::text,4,'0'),
       case when (m.patient_index-1)%4=2 then 'waiting' else 'called' end,
       'routine'::priority_level,case when (m.patient_index-1)%4=2 then 20 else 0 end,
       case when (m.patient_index-1)%4=3 then now()-interval '5 minutes' end,
       case when (m.patient_index-1)%4=3 then m.doctor_id end,
       m.doctor_id,m.doctor_id,v.appointment_id,now()-interval '20 minutes'
from _gc_demo_patient_map m
join visits v on v.hospital_id=m.hospital_id
 and v.visit_no='VIS-NET-H'||right(m.hospital_code,2)||'-'||lpad(m.patient_index::text,4,'0')
where not m.inpatient
on conflict do nothing;

-- Only newly created admissions allocate beds. A rerun cannot reopen a
-- discharged patient, move an existing patient, or reset a changed bed status.
create temporary table _gc_new_admissions on commit drop as
with inserted as (
  insert into admissions(hospital_id,patient_id,visit_id,ward_id,bed_id,consultant_id,
    admission_no,reason,priority,admitted_at,status,created_by,updated_by,admission_type,
    presenting_complaint,identity_confirmed_by,identity_confirmed_at,admission_notes)
  select m.hospital_id,m.patient_id,v.id,m.ward_id,m.bed_id,m.doctor_id,
         'ADM-NET-H'||right(m.hospital_code,2)||'-'||lpad(m.patient_index::text,4,'0'),
         'Synthetic demo admission','routine'::priority_level,now()-interval '1 day',
         'active'::record_status,m.doctor_id,m.doctor_id,'ELECTIVE',
         'Demo record only',m.doctor_id,now()-interval '1 day',
         'Synthetic fixture for ward and bed workflows; no clinical diagnosis supplied'
  from _gc_demo_patient_map m
  join visits v on v.hospital_id=m.hospital_id
   and v.visit_no='VIS-NET-H'||right(m.hospital_code,2)||'-'||lpad(m.patient_index::text,4,'0')
  where m.inpatient
  on conflict do nothing returning *
) select * from inserted;

insert into patient_bed_assignments(id,hospital_id,patient_id,admission_id,ward_id,room_id,
  bed_id,assigned_by,assigned_at,active)
select md5('govcare-demo-network-v1:assignment:'||a.id)::uuid,
       a.hospital_id,a.patient_id,a.id,a.ward_id,b.room_id,a.bed_id,a.consultant_id,a.admitted_at,true
from _gc_new_admissions a join beds b on b.id=a.bed_id
on conflict do nothing;

update beds b set status='OCCUPIED',current_patient_id=a.patient_id,current_admission_id=a.id,version=b.version+1
from _gc_new_admissions a where b.id=a.bed_id and b.hospital_id=a.hospital_id
  and b.status='AVAILABLE' and b.current_patient_id is null and b.current_admission_id is null;

do $$
declare
  fixture_hospital record;
begin
  if (select count(*) from hospitals
      where code ~ '^DEMO-HOSP-(0[1-9]|10)$' and settings->>'govcare_demo_fixture'='network-v1')<>10 then
    raise exception 'Expected all 10 labelled demo hospitals. Run npm run demo:seed first.';
  end if;
  for fixture_hospital in select id,code from hospitals
      where code ~ '^DEMO-HOSP-(0[1-9]|10)$' and settings->>'govcare_demo_fixture'='network-v1'
  loop
    if (select count(*) from patients where hospital_id=fixture_hospital.id and patient_no ~ '^PAT-NET-H[0-9]{2}-[0-9]{4}$')<400 then
      raise exception '% has fewer than 400 fixture patients.',fixture_hospital.code;
    end if;
    if (select count(*) from app_users where hospital_id=fixture_hospital.id and role='doctor' and auth_uid like 'govcare-demo-network-v1:%')<100 then
      raise exception '% has fewer than 100 fixture doctors.',fixture_hospital.code;
    end if;
    if (select count(*) from wards where hospital_id=fixture_hospital.id and ward_code ~ '^DEMO-W-[0-9]{3}$')<100 then
      raise exception '% has fewer than 100 fixture wards.',fixture_hospital.code;
    end if;
    if (select count(*) from beds where hospital_id=fixture_hospital.id and bed_code ~ '^DEMO-B-[0-9]{3}-[0-9]{2}$')<800 then
      raise exception '% has fewer than 800 fixture beds.',fixture_hospital.code;
    end if;
    if (select count(*) from visits where hospital_id=fixture_hospital.id and visit_no like 'VIS-NET-%')<400
       or (select count(*) from admissions where hospital_id=fixture_hospital.id and admission_no like 'ADM-NET-%')<200
       or (select count(*) from appointments where hospital_id=fixture_hospital.id and appointment_no like 'APT-NET-%')<200 then
      raise exception '% is missing linked fixture visits, admissions, or appointments.',fixture_hospital.code;
    end if;
  end loop;

  -- The existing schema has UUID foreign keys; also assert hospital equality.
  if exists (
    select 1 from app_users u join hospitals h on h.id=u.hospital_id
    left join departments d on d.id=u.department_id left join patients p on p.id=u.patient_id
    where h.settings->>'govcare_demo_fixture'='network-v1'
      and (d.hospital_id is distinct from u.hospital_id and u.department_id is not null
           or p.hospital_id is distinct from u.hospital_id and u.patient_id is not null)
  ) then raise exception 'A demo user has a cross-hospital department or patient identity.'; end if;

  if exists (
    select 1 from patients p join hospitals h on h.id=p.hospital_id
    join guardians g on g.id=p.guardian_id
    where h.settings->>'govcare_demo_fixture'='network-v1' and g.hospital_id<>p.hospital_id
  ) then raise exception 'A demo guardian relationship crosses hospitals.'; end if;

  if exists (
    select 1 from wards w join hospitals h on h.id=w.hospital_id
    left join departments d on d.id=w.department_id
    left join app_users u on u.id=w.responsible_consultant_id
    left join app_users m on m.id=w.ward_manager_id
    where h.settings->>'govcare_demo_fixture'='network-v1'
      and (d.hospital_id is distinct from w.hospital_id or u.hospital_id is distinct from w.hospital_id
        or m.hospital_id is distinct from w.hospital_id and w.ward_manager_id is not null)
  ) then raise exception 'A demo ward references another hospital.'; end if;

  if exists (
    select 1 from beds b join hospitals h on h.id=b.hospital_id
    join wards w on w.id=b.ward_id join ward_rooms r on r.id=b.room_id
    where h.settings->>'govcare_demo_fixture'='network-v1'
      and (b.hospital_id<>w.hospital_id or r.ward_id<>w.id)
  ) then raise exception 'A demo bed is assigned to the wrong ward or room.'; end if;

  if exists (
    select 1 from visits v join hospitals h on h.id=v.hospital_id
    join patients p on p.id=v.patient_id join app_users d on d.id=v.doctor_id
    join departments dept on dept.id=v.department_id
    where h.settings->>'govcare_demo_fixture'='network-v1'
      and (v.hospital_id<>p.hospital_id or v.hospital_id<>d.hospital_id or v.hospital_id<>dept.hospital_id)
  ) then raise exception 'A demo visit crosses hospitals.'; end if;

  if exists (
    select 1 from appointments a join hospitals h on h.id=a.hospital_id
    join patients p on p.id=a.patient_id join app_users d on d.id=a.doctor_id
    join departments dept on dept.id=a.department_id
    where h.settings->>'govcare_demo_fixture'='network-v1'
      and (a.hospital_id<>p.hospital_id or a.hospital_id<>d.hospital_id or a.hospital_id<>dept.hospital_id)
  ) then raise exception 'A demo appointment crosses hospitals.'; end if;

  if exists (
    select 1 from opd_queue q join hospitals h on h.id=q.hospital_id
    join visits v on v.id=q.visit_id join patients p on p.id=q.patient_id
    join app_users d on d.id=q.doctor_id join departments dept on dept.id=q.department_id
    where h.settings->>'govcare_demo_fixture'='network-v1'
      and (q.hospital_id<>v.hospital_id or q.hospital_id<>p.hospital_id or q.hospital_id<>d.hospital_id
        or q.hospital_id<>dept.hospital_id or q.patient_id<>v.patient_id or q.doctor_id<>v.doctor_id)
  ) then raise exception 'A demo queue entry has inconsistent links.'; end if;

  if exists (
    select 1 from admissions a join hospitals h on h.id=a.hospital_id
    join patients p on p.id=a.patient_id join app_users d on d.id=a.consultant_id
    join wards w on w.id=a.ward_id join beds b on b.id=a.bed_id join visits v on v.id=a.visit_id
    where h.settings->>'govcare_demo_fixture'='network-v1'
      and (a.hospital_id<>p.hospital_id or a.hospital_id<>d.hospital_id or a.hospital_id<>w.hospital_id
        or a.hospital_id<>b.hospital_id or b.ward_id<>a.ward_id
        or a.hospital_id<>v.hospital_id or a.patient_id<>v.patient_id)
  ) then raise exception 'A demo admission has inconsistent patient, doctor, ward, bed or visit links.'; end if;

  if exists (
    select 1 from patient_bed_assignments x join hospitals h on h.id=x.hospital_id
    join admissions a on a.id=x.admission_id join beds b on b.id=x.bed_id join ward_rooms r on r.id=x.room_id
    where h.settings->>'govcare_demo_fixture'='network-v1' and x.active
      and (x.hospital_id<>a.hospital_id or x.patient_id<>a.patient_id or x.ward_id<>a.ward_id
        or x.bed_id<>a.bed_id or b.ward_id<>x.ward_id or r.ward_id<>x.ward_id
        or b.hospital_id<>x.hospital_id or b.current_patient_id is distinct from x.patient_id
        or b.current_admission_id is distinct from a.id or b.status<>'OCCUPIED'
        or a.status<>'active' or a.discharged_at is not null)
  ) then raise exception 'A demo active admission and bed assignment disagree.'; end if;
end $$;

commit;

select h.code,h.name,
       (select count(*) from patients p where p.hospital_id=h.id) as patients,
       (select count(*) from app_users u where u.hospital_id=h.id and u.role='doctor') as doctors,
       (select count(*) from wards w where w.hospital_id=h.id) as wards,
       (select count(*) from beds b where b.hospital_id=h.id) as beds
from hospitals h where h.code ~ '^DEMO-HOSP-(0[1-9]|10)$'
  and h.settings->>'govcare_demo_fixture'='network-v1' order by h.code;
