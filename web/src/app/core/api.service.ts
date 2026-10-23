import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { environment } from '../../environments/environment';
import {
  Brocante,
  BrocanteSaisie,
  Emplacement,
  PageResultats,
  Recherche,
  Reservation,
  ReservationCreee,
} from './models';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);
  readonly base = environment.apiUrl;

  // --- Public
  rechercher(r: Recherche) {
    let params = new HttpParams();
    for (const [k, v] of Object.entries(r)) {
      if (v !== undefined && v !== null && v !== '') params = params.set(k, String(v));
    }
    return this.http.get<PageResultats<Brocante>>(`${this.base}/brocantes`, { params });
  }

  brocante(id: string) {
    return this.http.get<Brocante>(`${this.base}/brocantes/${id}`);
  }

  photoUrl(id: string, version = '') {
    return `${this.base}/brocantes/${id}/photo${version ? `?v=${version}` : ''}`;
  }

  // --- Client
  reserver(brocanteId: string, emplacementIds: string[]) {
    return this.http.post<ReservationCreee>(`${this.base}/reservations`, { brocanteId, emplacementIds });
  }

  reservation(id: string) {
    return this.http.get<Reservation>(`${this.base}/reservations/${id}`);
  }

  annulerReservation(id: string) {
    return this.http.delete<Reservation>(`${this.base}/reservations/${id}`);
  }

  mesReservations() {
    return this.http.get<Reservation[]>(`${this.base}/reservations/mes`);
  }

  // --- Admin
  adminBrocantes() {
    return this.http.get<Brocante[]>(`${this.base}/admin/brocantes`);
  }

  adminBrocante(id: string) {
    return this.http.get<Brocante>(`${this.base}/admin/brocantes/${id}`);
  }

  creerBrocante(b: BrocanteSaisie) {
    return this.http.post<Brocante>(`${this.base}/admin/brocantes`, b);
  }

  modifierBrocante(id: string, b: BrocanteSaisie) {
    return this.http.put<Brocante>(`${this.base}/admin/brocantes/${id}`, b);
  }

  envoyerPhoto(id: string, photo: Blob) {
    const data = new FormData();
    data.append('photo', photo, 'place.jpg');
    return this.http.post<{ ok: boolean }>(`${this.base}/admin/brocantes/${id}/photo`, data);
  }

  enregistrerPlan(id: string, emplacements: Emplacement[]) {
    const propres = emplacements.map(({ numero, x, y, largeur, hauteur, prix, tailleMetres }) => ({
      numero, x, y, largeur, hauteur, prix, tailleMetres,
    }));
    return this.http.put<Emplacement[]>(`${this.base}/admin/brocantes/${id}/emplacements`, { emplacements: propres });
  }

  publier(id: string) {
    return this.http.post<Brocante>(`${this.base}/admin/brocantes/${id}/publier`, {});
  }

  bloquer(id: string, empId: string, bloque: boolean) {
    return this.http.patch<Emplacement>(`${this.base}/admin/brocantes/${id}/emplacements/${empId}`, { bloque });
  }

  reservationsBrocante(id: string) {
    return this.http.get<Reservation[]>(`${this.base}/admin/brocantes/${id}/reservations`);
  }
}
